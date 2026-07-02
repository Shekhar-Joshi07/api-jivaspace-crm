import Lead from '../models/Lead.js';
import LeadTransferLog from '../models/LeadTransferLog.js';
import User from '../models/User.js';
import { createNotification } from '../services/notificationService.js';
import { buildAssignmentFilter, getManagedUserIds, isAdmin } from '../utils/accessControl.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const populateLog = query => query
  .populate('lead', 'name phone status requirement assignedTo')
  .populate('project', 'name code')
  .populate('fromUser toUser transferredBy acknowledgedBy', 'name email role');

const getScope = async user => {
  const ids = await getManagedUserIds(user);
  return ids ? {
    $or: [
      { fromUser: { $in: ids } },
      { toUser: { $in: ids } },
      { transferredBy: { $in: ids } }
    ]
  } : {};
};

const getAccessibleLog = async (id, user) => {
  const log = await populateLog(LeadTransferLog.findOne({ _id: id, ...(await getScope(user)) }));
  if (!log) throw new ApiError(404, 'Lead transfer log not found');
  return log;
};

export const getTransferLogs = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = await getScope(req.user);
  for (const field of ['lead', 'fromUser', 'toUser', 'transferredBy', 'transferType']) {
    if (req.query[field]) filter[field] = req.query[field];
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  const [logs, total] = await Promise.all([
    populateLog(LeadTransferLog.find(filter).sort('-createdAt').skip(skip).limit(limit)),
    LeadTransferLog.countDocuments(filter)
  ]);
  return sendSuccess(res, { data: logs, pagination: paginationMeta(page, limit, total) });
};

export const getTransferLog = async (req, res) => sendSuccess(res, {
  data: await getAccessibleLog(req.params.id, req.user)
});

export const createTransferLog = async (req, res) => {
  const lead = await Lead.findOne({ _id: req.body.lead, ...(await buildAssignmentFilter(req.user)) });
  if (!lead) throw new ApiError(404, 'Accessible lead not found');
  const target = await User.findOne({ _id: req.body.toUser, isActive: true });
  if (!target) throw new ApiError(422, 'Receiving user not found');
  if (!isAdmin(req.user)) {
    const ids = await getManagedUserIds(req.user);
    if (!ids.some(id => String(id) === String(target._id))) {
      throw new ApiError(403, 'You can only transfer leads within your reporting team');
    }
  }
  const log = await LeadTransferLog.create({
    lead: lead._id,
    fromUser: lead.assignedTo,
    toUser: target._id,
    transferredBy: req.user._id,
    transferType: req.body.transferType || 'Transfer',
    reason: req.body.reason,
    previousStatus: lead.status,
    previousNextFollowUp: lead.nextFollowUp,
    project: lead.project
  });
  lead.assignedTo = target._id;
  lead.assignedBy = req.user._id;
  lead.assignedAt = new Date();
  lead.updatedBy = req.user._id;
  await lead.save();
  await createNotification({
    user: target._id, title: 'Lead transferred',
    message: `${lead.name} has been transferred to you`, type: 'lead_transferred',
    relatedLead: lead._id, relatedProject: lead.project
  });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Lead transferred successfully',
    data: await populateLog(LeadTransferLog.findById(log._id))
  });
};

export const updateTransferLog = async (req, res) => {
  const log = await getAccessibleLog(req.params.id, req.user);
  if (req.body.reason !== undefined) log.reason = req.body.reason;
  if (req.body.acknowledged === true) {
    if (String(log.toUser._id) !== String(req.user._id) && !isAdmin(req.user)) {
      throw new ApiError(403, 'Only the receiving user can acknowledge this transfer');
    }
    log.acknowledgedAt = new Date();
    log.acknowledgedBy = req.user._id;
  }
  await log.save();
  return sendSuccess(res, {
    message: 'Lead transfer log updated successfully',
    data: await populateLog(LeadTransferLog.findById(log._id))
  });
};

export const deleteTransferLog = async (req, res) => {
  const log = await LeadTransferLog.findById(req.params.id);
  if (!log) throw new ApiError(404, 'Lead transfer log not found');
  await log.deleteOne();
  return sendSuccess(res, { message: 'Lead transfer log deleted successfully' });
};
