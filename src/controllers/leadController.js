import { unlink } from 'node:fs/promises';
import Activity, { ACTIVITY_TYPES } from '../models/Activity.js';
import Booking from '../models/Booking.js';
import FileRecord from '../models/File.js';
import Lead, { LEAD_STATUSES } from '../models/Lead.js';
import LeadTransferLog from '../models/LeadTransferLog.js';
import Notification from '../models/Notification.js';
import SiteVisit from '../models/SiteVisit.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { recordActivity } from '../services/activityService.js';
import {
  createWorkbookBuffer,
  mapLeadsForExport,
  readLeadWorkbook,
  validateLeadRows
} from '../services/excelService.js';
import { createNotification, createNotifications } from '../services/notificationService.js';
import {
  buildAssignmentFilter,
  canAccessAssignedRecord,
  getManagedUserIds,
  isAdmin
} from '../utils/accessControl.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const TERMINAL_STATUSES = ['Booking Done', 'Closure', 'Not Interested', 'Lost'];
const ACTIVE_STATUSES = LEAD_STATUSES.filter(status => !TERMINAL_STATUSES.includes(status));

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toObjectIdString = value => String(value?._id || value || '');

const normalizeDate = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const baseLead = lead => ({
  customerName: lead.customerName || lead.name,
  name: lead.customerName || lead.name,
  mobile: lead.mobile || lead.phone,
  phone: lead.mobile || lead.phone,
  alternateMobile: lead.alternateMobile || lead.alternatePhone || null,
  alternatePhone: lead.alternateMobile || lead.alternatePhone || null,
  email: lead.email || null,
  leadSource: lead.leadSource || lead.source || null,
  source: lead.leadSource || lead.source || null,
  interestedProject: lead.interestedProject || lead.project || null,
  project: lead.interestedProject || lead.project || null,
  interestedPropertyType: lead.interestedPropertyType || lead.propertyType || null,
  propertyType: lead.interestedPropertyType || lead.propertyType || null,
  budget: lead.budget ?? null,
  locationPreference: lead.locationPreference || lead.preferredLocation || null,
  preferredLocation: lead.locationPreference || lead.preferredLocation || null,
  status: lead.status,
  priority: lead.priority,
  assignedTo: lead.assignedTo || null,
  followUpDate: lead.followUpDate || lead.nextFollowUp || null,
  remarks: lead.remarks || lead.notes?.at?.(-1)?.text || null,
  createdBy: lead.createdBy || null
});

const formatUser = user => (user ? {
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  employeeId: user.employeeId || null
} : null);

const formatProject = project => (project ? {
  id: project._id,
  name: project.name,
  code: project.code || null,
  status: project.status || null,
  address: project.address || null
} : null);

const formatLead = lead => {
  const obj = typeof lead?.toObject === 'function' ? lead.toObject() : lead;
  return {
    id: obj._id,
    ...baseLead(obj),
    assignedTo: formatUser(obj.assignedTo),
    createdBy: formatUser(obj.createdBy),
    updatedBy: formatUser(obj.updatedBy),
    interestedProject: formatProject(obj.project || obj.interestedProject),
    project: formatProject(obj.project || obj.interestedProject),
    notes: obj.notes || [],
    statusHistory: obj.statusHistory || [],
    isArchived: !!obj.isArchived,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

const formatLeadQuery = query => query
  .populate('assignedTo assignedBy createdBy updatedBy', 'name email phone role employeeId')
  .populate('project', 'name code status address developerName')
  .populate('notes.createdBy statusHistory.changedBy', 'name email role employeeId');

const normalizeLeadInput = body => {
  const payload = {};
  const mapping = {
    customerName: 'name',
    name: 'name',
    mobile: 'phone',
    phone: 'phone',
    alternateMobile: 'alternatePhone',
    alternatePhone: 'alternatePhone',
    leadSource: 'source',
    source: 'source',
    interestedProject: 'project',
    project: 'project',
    interestedPropertyType: 'propertyType',
    propertyType: 'propertyType',
    locationPreference: 'preferredLocation',
    preferredLocation: 'preferredLocation',
    email: 'email',
    budget: 'budget',
    priority: 'priority',
    status: 'status',
    assignedTo: 'assignedTo',
    followUpDate: 'followUpDate',
    nextFollowUp: 'nextFollowUp',
    remarks: 'remarks',
    estimatedValue: 'estimatedValue',
    revenue: 'revenue',
    isArchived: 'isArchived'
  };

  Object.entries(mapping).forEach(([sourceKey, targetKey]) => {
    if (body[sourceKey] !== undefined) payload[targetKey] = body[sourceKey];
  });

  if (body.locationPreference !== undefined || body.preferredLocation !== undefined) {
    const value = body.locationPreference ?? body.preferredLocation;
    payload.preferredLocation = value || undefined;
    payload.preferredLocations = value ? [value] : undefined;
  }

  if (body.remarks !== undefined) payload.remarks = body.remarks || undefined;

  return payload;
};

const buildLeadFilter = async (req) => {
  const filter = await buildAssignmentFilter(req.user);
  const query = req.query;
  const and = [];

  for (const field of ['status', 'priority', 'assignedTo', 'createdBy']) {
    if (query[field]) filter[field] = query[field];
  }

  if (query.leadSource || query.source) filter.source = query.leadSource || query.source;
  if (query.interestedProject || query.project) filter.project = query.interestedProject || query.project;
  if (query.interestedPropertyType || query.propertyType) {
    filter.propertyType = query.interestedPropertyType || query.propertyType;
  }
  if (query.isArchived !== undefined) filter.isArchived = query.isArchived === 'true';

  const search = query.search?.trim();
  if (search) {
    const escaped = escapeRegExp(search);
    and.push({
      $or: [
        { name: new RegExp(escaped, 'i') },
        { phone: new RegExp(escaped, 'i') },
        { alternatePhone: new RegExp(escaped, 'i') },
        { email: new RegExp(escaped, 'i') },
        { preferredLocation: new RegExp(escaped, 'i') },
        { remarks: new RegExp(escaped, 'i') }
      ]
    });
  }

  const followUpRange = {};
  const followUpFrom = normalizeDate(query.followUpFrom);
  const followUpTo = normalizeDate(query.followUpTo);
  if (followUpFrom) followUpRange.$gte = followUpFrom;
  if (followUpTo) followUpRange.$lte = followUpTo;
  if (Object.keys(followUpRange).length) {
    and.push({
      $or: [
        { followUpDate: followUpRange },
        { nextFollowUp: followUpRange }
      ]
    });
  }

  const createdRange = {};
  const createdFrom = normalizeDate(query.createdFrom);
  const createdTo = normalizeDate(query.createdTo);
  if (createdFrom) createdRange.$gte = createdFrom;
  if (createdTo) createdRange.$lte = createdTo;
  if (Object.keys(createdRange).length) and.push({ createdAt: createdRange });

  if (and.length) filter.$and = and;
  return filter;
};

const leadScope = user => buildAssignmentFilter(user);

const getAccessibleLead = async (id, user) => {
  const lead = await formatLeadQuery(Lead.findOne({ _id: id, ...(await leadScope(user)) }));
  if (!lead) throw new ApiError(404, 'Lead not found');
  return lead;
};

const assertAssignmentAllowed = async (actor, assignedTo) => {
  const target = await User.findOne({ _id: assignedTo, isActive: true });
  if (!target) throw new ApiError(422, 'Assigned user does not exist or is inactive');
  if (isAdmin(actor)) return target;
  const ids = await getManagedUserIds(actor);
  if (!ids.some(id => String(id) === String(target._id))) {
    throw new ApiError(403, 'You can only assign leads within your reporting team');
  }
  return target;
};

const appendStatusHistory = (lead, fromStatus, actor, reason) => {
  if (fromStatus !== lead.status) {
    lead.statusHistory.push({
      from: fromStatus,
      to: lead.status,
      changedBy: actor._id,
      reason
    });
  }
};

const ensureUniqueMobile = async ({ mobile, excludeLeadId }) => {
  if (!mobile) return;
  const duplicate = await Lead.findOne({
    $or: [{ phone: mobile }, { alternatePhone: mobile }],
    ...(excludeLeadId ? { _id: { $ne: excludeLeadId } } : {})
  }).select('_id name phone alternatePhone');
  if (duplicate) {
    throw new ApiError(409, 'A lead with this mobile number already exists');
  }
};

const writeRemark = async (lead, remark, userId) => {
  if (!remark) return;
  lead.remarks = remark;
  lead.notes.push({ text: remark, createdBy: userId });
};

const recordLeadAssignmentNotification = async (lead, assigneeId, title) => {
  if (toObjectIdString(lead.assignedTo) === toObjectIdString(assigneeId)) return;
  await createNotification({
    user: assigneeId,
    title,
    message: `${lead.name} has been assigned to you`,
    type: 'lead_assigned',
    relatedLead: lead._id
  });
};

export const getLeads = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = await buildLeadFilter(req);
  const sortMap = {
    oldest: 'createdAt',
    latest: '-createdAt',
    followUp: 'followUpDate',
    name: 'name',
    mobile: 'phone',
    status: 'status',
    priority: '-priority'
  };

  const [leads, total] = await Promise.all([
    formatLeadQuery(Lead.find(filter).sort(sortMap[req.query.sort] || '-createdAt').skip(skip).limit(limit)),
    Lead.countDocuments(filter)
  ]);

  return sendSuccess(res, {
    data: leads.map(formatLead),
    pagination: paginationMeta(page, limit, total)
  });
};

export const getLead = async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  return sendSuccess(res, { data: formatLead(lead) });
};

export const checkDuplicateMobile = async (req, res) => {
  const mobile = String(req.query.mobile || req.params.mobile || '').trim();
  if (!mobile) throw new ApiError(400, 'Mobile number is required');
  const duplicate = await Lead.findOne({
    $or: [{ phone: mobile }, { alternatePhone: mobile }],
    ...(req.query.excludeLeadId ? { _id: { $ne: req.query.excludeLeadId } } : {})
  }).select('_id name phone');
  return sendSuccess(res, {
    data: {
      exists: !!duplicate,
      leadId: duplicate?._id || null,
      customerName: duplicate?.name || null,
      mobile: duplicate?.phone || null
    }
  });
};

export const createLead = async (req, res) => {
  const payload = normalizeLeadInput(req.body);
  payload.assignedTo ||= req.user._id;
  payload.createdBy = req.user._id;
  payload.updatedBy = req.user._id;

  if (payload.assignedTo) await assertAssignmentAllowed(req.user, payload.assignedTo);
  await ensureUniqueMobile({ mobile: payload.phone });

  const lead = await Lead.create({
    ...payload,
    assignedBy: payload.assignedTo ? req.user._id : undefined,
    assignedAt: payload.assignedTo ? new Date() : undefined,
    status: payload.status || 'New',
    statusHistory: [{ to: payload.status || 'New', changedBy: req.user._id }],
    notes: payload.remarks ? [{ text: payload.remarks, createdBy: req.user._id }] : []
  });

  await recordActivity({
    lead: lead._id,
    user: req.user._id,
    type: 'Lead Created',
    description: `Created lead ${lead.name}`
  });

  if (toObjectIdString(lead.assignedTo) !== toObjectIdString(req.user._id)) {
    await createNotification({
      user: lead.assignedTo,
      title: 'New lead assigned',
      message: `${lead.name} has been assigned to you`,
      type: 'lead_assigned',
      relatedLead: lead._id
    });
  }

  const created = await formatLeadQuery(Lead.findById(lead._id));
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Lead created successfully',
    data: formatLead(created)
  });
};

export const updateLead = async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  const payload = normalizeLeadInput(req.body);
  const oldStatus = lead.status;
  const oldMobile = lead.phone;
  const oldAssignee = toObjectIdString(lead.assignedTo);

  if (payload.phone && payload.phone !== oldMobile) {
    await ensureUniqueMobile({ mobile: payload.phone, excludeLeadId: lead._id });
  }
  if (payload.assignedTo && toObjectIdString(payload.assignedTo) !== oldAssignee) {
    await assertAssignmentAllowed(req.user, payload.assignedTo);
  }
  if (req.body.remarks !== undefined) {
    await writeRemark(lead, payload.remarks, req.user._id);
    delete payload.remarks;
  }

  lead.set({ ...payload, updatedBy: req.user._id });
  if (payload.assignedTo && toObjectIdString(payload.assignedTo) !== oldAssignee) {
    lead.assignedBy = req.user._id;
    lead.assignedAt = new Date();
  }
  appendStatusHistory(lead, oldStatus, req.user, req.body.statusReason);
  await lead.save();

  const operations = [
    recordActivity({
      lead: lead._id,
      user: req.user._id,
      type: 'Lead Updated',
      description: `Updated lead ${lead.name}`,
      metadata: { fields: Object.keys(payload) }
    })
  ];

  if (oldStatus !== lead.status) {
    operations.push(recordActivity({
      lead: lead._id,
      user: req.user._id,
      type: 'Status Change',
      description: `Changed status from ${oldStatus} to ${lead.status}`,
      metadata: { from: oldStatus, to: lead.status }
    }));
  }

  if (payload.assignedTo && toObjectIdString(payload.assignedTo) !== oldAssignee) {
    operations.push(recordLeadAssignmentNotification(lead, payload.assignedTo, 'Lead assigned'));
  }

  await Promise.all(operations);
  const updated = await formatLeadQuery(Lead.findById(lead._id));
  return sendSuccess(res, {
    message: 'Lead updated successfully',
    data: formatLead(updated)
  });
};

export const updateLeadStatus = async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  const nextStatus = req.body.status;
  const oldStatus = lead.status;

  lead.status = nextStatus;
  if (req.body.followUpDate) {
    lead.followUpDate = req.body.followUpDate;
    lead.nextFollowUp = req.body.followUpDate;
  }
  if (req.body.nextFollowUp) {
    lead.nextFollowUp = req.body.nextFollowUp;
    if (!req.body.followUpDate) lead.followUpDate = req.body.nextFollowUp;
  }
  if (req.body.remarks !== undefined) {
    await writeRemark(lead, req.body.remarks, req.user._id);
  }
  lead.updatedBy = req.user._id;
  appendStatusHistory(lead, oldStatus, req.user, req.body.reason || req.body.remarks);
  await lead.save();

  await recordActivity({
    lead: lead._id,
    user: req.user._id,
    type: 'Status Change',
    description: `Changed status from ${oldStatus} to ${nextStatus}`,
    metadata: { from: oldStatus, to: nextStatus }
  });

  const updated = await formatLeadQuery(Lead.findById(lead._id));
  return sendSuccess(res, {
    message: 'Lead status updated successfully',
    data: formatLead(updated)
  });
};

export const addRemark = async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  await writeRemark(lead, req.body.remarks, req.user._id);
  lead.updatedBy = req.user._id;
  await lead.save();

  await recordActivity({
    lead: lead._id,
    user: req.user._id,
    type: 'Note',
    description: req.body.remarks
  });

  const updated = await formatLeadQuery(Lead.findById(lead._id));
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Remark added successfully',
    data: formatLead(updated)
  });
};

export const addActivityTimelineEntry = async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  const activity = await recordActivity({
    lead: lead._id,
    user: req.user._id,
    type: req.body.type,
    description: req.body.description,
    channel: req.body.channel,
    direction: req.body.direction,
    outcome: req.body.outcome,
    durationSeconds: req.body.durationSeconds,
    metadata: req.body.metadata || {}
  });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Activity timeline entry added successfully',
    data: activity
  });
};

export const assignLead = async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  await assertAssignmentAllowed(req.user, req.body.assignedTo);
  const previousAssignee = toObjectIdString(lead.assignedTo);

  lead.assignedTo = req.body.assignedTo;
  lead.assignedBy = req.user._id;
  lead.assignedAt = new Date();
  lead.updatedBy = req.user._id;
  await lead.save();

  await Promise.all([
    recordActivity({
      lead: lead._id,
      user: req.user._id,
      type: 'Lead Assigned',
      description: `Assigned ${lead.name}`,
      metadata: { from: previousAssignee, to: req.body.assignedTo }
    }),
    createNotification({
      user: req.body.assignedTo,
      title: 'Lead assigned',
      message: `${lead.name} has been assigned to you`,
      type: 'lead_assigned',
      relatedLead: lead._id
    })
  ]);

  const updated = await formatLeadQuery(Lead.findById(lead._id));
  return sendSuccess(res, {
    message: 'Lead assigned successfully',
    data: formatLead(updated)
  });
};

const createTransferLog = async ({ lead, fromUser, toUser, actor, reason, transferType }) => {
  await LeadTransferLog.create({
    lead: lead._id,
    fromUser,
    toUser,
    transferredBy: actor._id,
    transferType,
    reason,
    previousStatus: lead.status,
    previousNextFollowUp: lead.nextFollowUp
  });
};

export const transferLead = async (req, res) => {
  const lead = await getAccessibleLead(req.body.leadId, req.user);
  await assertAssignmentAllowed(req.user, req.body.toUser);
  const fromUser = lead.assignedTo?._id || lead.assignedTo;

  lead.assignedTo = req.body.toUser;
  lead.assignedBy = req.user._id;
  lead.assignedAt = new Date();
  lead.updatedBy = req.user._id;
  await lead.save();

  await Promise.all([
    createTransferLog({
      lead,
      fromUser,
      toUser: req.body.toUser,
      actor: req.user,
      reason: req.body.reason,
      transferType: 'Transfer'
    }),
    recordActivity({
      lead: lead._id,
      user: req.user._id,
      type: 'Lead Transferred',
      description: `Transferred ${lead.name}`,
      metadata: { from: fromUser, to: req.body.toUser, reason: req.body.reason }
    }),
    createNotification({
      user: req.body.toUser,
      title: 'Lead transferred',
      message: `${lead.name} has been transferred to you`,
      type: 'lead_transferred',
      relatedLead: lead._id
    })
  ]);

  const log = await LeadTransferLog.findOne({ lead: lead._id })
    .sort('-createdAt')
    .populate('lead', 'name phone status')
    .populate('fromUser toUser transferredBy', 'name email role');

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Lead transferred successfully',
    data: log
  });
};

export const bulkTransferLeads = async (req, res) => {
  const ids = [...new Set((req.body.leadIds || []).map(String))];
  if (!ids.length) throw new ApiError(400, 'Provide at least one lead ID');
  await assertAssignmentAllowed(req.user, req.body.toUser);

  const leads = await Lead.find({ _id: { $in: ids }, ...(await leadScope(req.user)) });
  if (leads.length !== ids.length) {
    throw new ApiError(404, 'One or more accessible leads were not found');
  }

  const now = new Date();
  await LeadTransferLog.insertMany(leads.map(lead => ({
    lead: lead._id,
    fromUser: lead.assignedTo,
    toUser: req.body.toUser,
    transferredBy: req.user._id,
    transferType: 'Transfer',
    reason: req.body.reason,
    previousStatus: lead.status,
    previousNextFollowUp: lead.nextFollowUp,
    createdAt: now,
    updatedAt: now
  })));

  await Lead.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        assignedTo: req.body.toUser,
        assignedBy: req.user._id,
        assignedAt: now,
        updatedBy: req.user._id
      }
    }
  );

  await createNotifications(leads.map(lead => ({
    user: req.body.toUser,
    title: 'Lead transferred',
    message: `${lead.name} has been transferred to you`,
    type: 'lead_transferred',
    relatedLead: lead._id
  })));

  return sendSuccess(res, {
    message: `${leads.length} leads transferred successfully`,
    data: { transferred: leads.length, toUser: req.body.toUser }
  });
};

const getStatusBuckets = () => Object.fromEntries(LEAD_STATUSES.map(status => [status, []]));

export const getPipeline = async (req, res) => {
  const leads = await formatLeadQuery(Lead.find({ ...(await leadScope(req.user)), isArchived: false })
    .sort({ priority: -1, updatedAt: -1 }));
  const buckets = getStatusBuckets();
  leads.forEach(lead => buckets[lead.status]?.push(formatLead(lead)));
  return sendSuccess(res, { data: buckets });
};

export const getPendingLeads = async (req, res) => {
  const filter = {
    ...(await leadScope(req.user)),
    isArchived: false,
    status: { $nin: TERMINAL_STATUSES }
  };
  if (req.query.overdue === 'true') {
    filter.$or = [{ followUpDate: { $lt: new Date() } }, { nextFollowUp: { $lt: new Date() } }];
  }
  const leads = await formatLeadQuery(Lead.find(filter).sort({ followUpDate: 1, nextFollowUp: 1, updatedAt: -1 }).limit(500));
  return sendSuccess(res, { data: leads.map(formatLead) });
};

export const getLeadResponses = async (req, res) => {
  const leads = await formatLeadQuery(Lead.find({
    ...(await leadScope(req.user)),
    $or: [{ remarks: { $exists: true, $ne: '' } }, { lastContactedAt: { $exists: true } }]
  }).sort('-lastContactedAt').limit(500));
  return sendSuccess(res, { data: leads.map(formatLead) });
};

export const getCalendarFollowUps = async (req, res) => {
  const from = normalizeDate(req.query.from) || new Date();
  const to = normalizeDate(req.query.to) || new Date(from.getTime() + 30 * 86400000);
  if (to < from) throw new ApiError(400, 'Provide a valid calendar date range');

  const leads = await formatLeadQuery(Lead.find({
    ...(await leadScope(req.user)),
    isArchived: false,
    status: { $nin: TERMINAL_STATUSES },
    $or: [
      { followUpDate: { $gte: from, $lte: to } },
      { nextFollowUp: { $gte: from, $lte: to } }
    ]
  }).sort({ followUpDate: 1, nextFollowUp: 1 }));

  return sendSuccess(res, {
    data: leads.map(lead => {
      const formatted = formatLead(lead);
      return {
        id: formatted.id,
        title: `Follow-up: ${formatted.customerName}`,
        start: formatted.followUpDate,
        type: 'lead_follow_up',
        status: formatted.status,
        priority: formatted.priority,
        lead: formatted
      };
    })
  });
};

const applyLeadImportRow = row => ({
  name: row.customerName || row.name,
  phone: row.mobile || row.phone,
  alternatePhone: row.alternateMobile || row.alternatePhone,
  email: row.email,
  source: row.leadSource || row.source || 'Other',
  project: row.interestedProject || row.project,
  propertyType: row.interestedPropertyType || row.propertyType,
  preferredLocation: row.locationPreference || row.preferredLocation,
  followUpDate: row.followUpDate || row.nextFollowUp,
  nextFollowUp: row.nextFollowUp || row.followUpDate,
  status: row.status || 'New',
  priority: row.priority || 'Medium',
  budget: row.budget,
  remarks: row.remarks
});

const importRows = async (rows, req) => {
  const { accepted, errors } = validateLeadRows(rows.map(applyLeadImportRow));
  const results = { created: 0, updated: 0, skipped: errors.length, errors };

  for (let index = 0; index < accepted.length; index += 1) {
    const leadData = accepted[index];
    try {
      const existing = await Lead.findOne({
        $or: [{ phone: leadData.phone }, { alternatePhone: leadData.phone }]
      });
      if (existing && !(await canAccessAssignedRecord(req.user, existing.assignedTo))) {
        throw new ApiError(403, 'Matching lead belongs to another reporting team');
      }

      if (existing) {
        existing.set({
          ...leadData,
          updatedBy: req.user._id
        });
        if (leadData.remarks) existing.remarks = leadData.remarks;
        appendStatusHistory(existing, existing.status, req.user, 'Excel import');
        await existing.save();
        results.updated += 1;
      } else {
        await Lead.create({
          ...leadData,
          assignedTo: req.user._id,
          assignedBy: req.user._id,
          assignedAt: new Date(),
          createdBy: req.user._id,
          updatedBy: req.user._id,
          statusHistory: [{ to: leadData.status || 'New', changedBy: req.user._id }],
          notes: leadData.remarks ? [{ text: leadData.remarks, createdBy: req.user._id }] : []
        });
        results.created += 1;
      }
    } catch (error) {
      results.skipped += 1;
      results.errors.push({ row: index + 2, message: error.message });
    }
  }

  return results;
};

export const bulkImportLeads = async (req, res) => {
  if (!Array.isArray(req.body.leads) || !req.body.leads.length) {
    throw new ApiError(400, 'Provide at least one lead');
  }
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Lead import completed',
    data: await importRows(req.body.leads, req)
  });
};

export const importLeadsFromExcel = async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Spreadsheet file is required');
  const rows = readLeadWorkbook(req.file.buffer);
  if (!rows.length) throw new ApiError(422, 'The spreadsheet contains no lead rows');
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Lead import completed',
    data: await importRows(rows, req)
  });
};

export const exportLeadsToExcel = async (req, res) => {
  const leads = await Lead.find(await leadScope(req.user))
    .populate('assignedTo', 'name')
    .populate('project', 'name code')
    .sort('-createdAt')
    .limit(20000)
    .lean();
  const buffer = createWorkbookBuffer([{ name: 'Leads', rows: mapLeadsForExport(leads) }]);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="real-estate-leads-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  return res.send(buffer);
};

export const deleteLead = async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  if (await Booking.exists({ lead: lead._id })) {
    throw new ApiError(409, 'Lead with booking history cannot be deleted; archive it instead');
  }

  const files = await FileRecord.find({ lead: lead._id }).select('+path');
  await Promise.all(files.map(file => unlink(file.path).catch(() => undefined)));

  await Promise.all([
    lead.deleteOne(),
    Activity.deleteMany({ lead: lead._id }),
    FileRecord.deleteMany({ lead: lead._id }),
    Notification.deleteMany({ relatedLead: lead._id }),
    Task.deleteMany({ $or: [{ relatedLead: lead._id }, { lead: lead._id }] }),
    SiteVisit.deleteMany({ lead: lead._id }),
    LeadTransferLog.deleteMany({ lead: lead._id })
  ]);

  return sendSuccess(res, { message: 'Lead and related records deleted successfully' });
};

export const addNote = addRemark;
export const updateLeadResponse = updateLeadStatus;
