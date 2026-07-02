import Lead from '../models/Lead.js';
import Project from '../models/Project.js';
import SiteVisit from '../models/SiteVisit.js';
import User from '../models/User.js';
import { recordActivity } from '../services/activityService.js';
import { createNotification } from '../services/notificationService.js';
import { buildAssignmentFilter, canAccessAssignedRecord } from '../utils/accessControl.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pick = body => {
  const payload = {};
  const fields = [
    'lead',
    'project',
    'visitDate',
    'visitTime',
    'assignedSalesPerson',
    'visitStatus',
    'customerFeedback',
    'nextFollowUpDate',
    'isActive',
    // legacy compatibility
    'scheduledAt',
    'status',
    'assignedTo',
    'feedback',
    'nextFollowUpAt',
    'cancellationReason',
    'rescheduledFrom',
    'accompaniedBy',
    'visitorCount',
    'pickupRequired',
    'pickupAddress',
    'checkInAt',
    'checkOutAt',
    'outcome'
  ];
  for (const field of fields) {
    if (body[field] !== undefined) payload[field] = body[field];
  }
  return payload;
};

const normalizePayload = body => {
  const payload = pick(body);
  if (!payload.visitDate && body.scheduledAt) payload.visitDate = body.scheduledAt;
  if (!payload.scheduledAt && payload.visitDate) payload.scheduledAt = payload.visitDate;
  if (!payload.visitStatus && body.status) payload.visitStatus = body.status;
  if (!payload.status && payload.visitStatus) payload.status = payload.visitStatus;
  if (!payload.assignedSalesPerson && body.assignedTo) payload.assignedSalesPerson = body.assignedTo;
  if (!payload.assignedTo && payload.assignedSalesPerson) payload.assignedTo = payload.assignedSalesPerson;
  if (!payload.customerFeedback && body.feedback) payload.customerFeedback = body.feedback;
  if (!payload.feedback && payload.customerFeedback) payload.feedback = payload.customerFeedback;
  if (!payload.nextFollowUpDate && body.nextFollowUpAt) payload.nextFollowUpDate = body.nextFollowUpAt;
  if (!payload.nextFollowUpAt && payload.nextFollowUpDate) payload.nextFollowUpAt = payload.nextFollowUpDate;
  return payload;
};

const populateVisit = query => query
  .populate('lead', 'customerName name mobile phone status assignedTo')
  .populate('project', 'projectName name builderName location status')
  .populate('assignedSalesPerson assignedTo createdBy updatedBy', 'name email role employeeId')
  .populate('rescheduledFrom', 'visitDate visitTime visitStatus')
  .populate('accompaniedBy', 'name email role');

const formatVisit = visit => {
  const obj = typeof visit?.toObject === 'function' ? visit.toObject() : visit;
  return {
    id: obj._id,
    lead: obj.lead,
    project: obj.project,
    visitDate: obj.visitDate || obj.scheduledAt || null,
    visitTime: obj.visitTime || null,
    assignedSalesPerson: obj.assignedSalesPerson || obj.assignedTo || null,
    visitStatus: obj.visitStatus || obj.status,
    customerFeedback: obj.customerFeedback || obj.feedback || null,
    nextFollowUpDate: obj.nextFollowUpDate || obj.nextFollowUpAt || null,
    isActive: !!obj.isActive,
    createdBy: obj.createdBy || null,
    updatedBy: obj.updatedBy || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

const assertReferences = async (payload, user) => {
  const lead = await Lead.findById(payload.lead);
  if (!lead || !(await canAccessAssignedRecord(user, lead.assignedTo))) {
    throw new ApiError(404, 'Accessible lead not found');
  }
  if (!(await Project.exists({ _id: payload.project, isActive: true }))) {
    throw new ApiError(422, 'Active project not found');
  }
  if (payload.assignedSalesPerson && !(await User.exists({ _id: payload.assignedSalesPerson, isActive: true }))) {
    throw new ApiError(422, 'Assigned sales person not found');
  }
  return lead;
};

const getAccessibleVisit = async (id, user) => {
  const leadScope = await buildAssignmentFilter(user);
  const leadIds = await Lead.find(leadScope).distinct('_id');
  const visit = await populateVisit(SiteVisit.findOne({ _id: id, lead: { $in: leadIds } }));
  if (!visit) throw new ApiError(404, 'Site visit not found');
  return visit;
};

export const getSiteVisits = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const leadIds = await Lead.find(await buildAssignmentFilter(req.user)).distinct('_id');
  const filter = { lead: { $in: leadIds } };

  for (const field of ['lead', 'project', 'assignedSalesPerson', 'assignedTo', 'visitStatus', 'status']) {
    if (req.query[field]) {
      filter[field === 'assignedTo' ? 'assignedSalesPerson' : field === 'status' ? 'visitStatus' : field] = req.query[field];
    }
  }

  if (req.query.search) {
    const search = new RegExp(escapeRegExp(req.query.search), 'i');
    filter.$or = [
      { visitTime: search },
      { customerFeedback: search },
      { visitStatus: search }
    ];
  }

  if (req.query.from || req.query.to) {
    filter.visitDate = {};
    if (req.query.from) filter.visitDate.$gte = new Date(req.query.from);
    if (req.query.to) filter.visitDate.$lte = new Date(req.query.to);
  }

  const [visits, total] = await Promise.all([
    populateVisit(SiteVisit.find(filter).sort({ visitDate: 1 }).skip(skip).limit(limit)),
    SiteVisit.countDocuments(filter)
  ]);

  return sendSuccess(res, { data: visits.map(formatVisit), pagination: paginationMeta(page, limit, total) });
};

export const getSiteVisit = async (req, res) => sendSuccess(res, {
  data: formatVisit(await getAccessibleVisit(req.params.id, req.user))
});

export const createSiteVisit = async (req, res) => {
  const payload = normalizePayload(req.body);
  payload.assignedSalesPerson ||= req.user._id;
  const lead = await assertReferences(payload, req.user);

  const visit = await SiteVisit.create({
    ...payload,
    createdBy: req.user._id,
    visitStatus: payload.visitStatus || 'Scheduled'
  });

  await Promise.all([
    recordActivity({
      lead: lead._id,
      project: visit.project,
      siteVisit: visit._id,
      user: req.user._id,
      type: 'Site Visit Scheduled',
      description: `Site visit scheduled for ${lead.customerName || lead.name || 'lead'}`,
      metadata: {
        visitDate: visit.visitDate,
        visitTime: visit.visitTime,
        visitStatus: visit.visitStatus
      }
    }),
    createNotification({
      user: visit.assignedSalesPerson,
      title: 'Site visit scheduled',
      message: `Site visit scheduled for ${lead.customerName || lead.name || 'lead'}`,
      type: 'site_visit',
      relatedLead: lead._id,
      relatedProject: visit.project,
      relatedSiteVisit: visit._id
    })
  ]);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Site visit created successfully',
    data: formatVisit(await populateVisit(SiteVisit.findById(visit._id)))
  });
};

export const updateSiteVisit = async (req, res) => {
  const visit = await getAccessibleVisit(req.params.id, req.user);
  const payload = normalizePayload(req.body);

  await assertReferences({
    lead: payload.lead || visit.lead._id,
    project: payload.project || visit.project._id,
    assignedSalesPerson: payload.assignedSalesPerson || visit.assignedSalesPerson._id || visit.assignedTo?._id
  }, req.user);

  const oldStatus = visit.visitStatus;
  visit.set({ ...payload, updatedBy: req.user._id });
  await visit.save();

  if (oldStatus !== visit.visitStatus) {
    await recordActivity({
      lead: visit.lead._id,
      project: visit.project._id,
      siteVisit: visit._id,
      user: req.user._id,
      type: visit.visitStatus === 'Completed' ? 'Site Visit Completed' : 'Site Visit Updated',
      description: `Site visit status changed from ${oldStatus} to ${visit.visitStatus}`,
      metadata: { from: oldStatus, to: visit.visitStatus }
    });
  }

  return sendSuccess(res, {
    message: 'Site visit updated successfully',
    data: formatVisit(await populateVisit(SiteVisit.findById(visit._id)))
  });
};

export const deleteSiteVisit = async (req, res) => {
  const visit = await getAccessibleVisit(req.params.id, req.user);
  await visit.deleteOne();
  return sendSuccess(res, { message: 'Site visit deleted successfully' });
};
