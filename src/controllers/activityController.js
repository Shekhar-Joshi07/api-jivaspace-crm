import Activity from '../models/Activity.js';
import Lead from '../models/Lead.js';
import { buildAssignmentFilter, getManagedUserIds, isAdmin } from '../utils/accessControl.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const editableFields = [
  'type', 'description', 'lead', 'project', 'propertyUnit', 'siteVisit',
  'booking', 'task', 'channel', 'direction', 'outcome', 'durationSeconds', 'metadata'
];

const populateActivity = query => query
  .populate('user', 'name email role')
  .populate('lead', 'name phone status')
  .populate('project', 'name code')
  .populate('propertyUnit', 'unitNumber tower type')
  .populate('siteVisit', 'scheduledAt status')
  .populate('booking', 'bookingNumber status')
  .populate('task', 'title status');

const getActivityScope = async user => {
  if (isAdmin(user)) return {};
  const [leadIds, userIds] = await Promise.all([
    Lead.find(await buildAssignmentFilter(user)).distinct('_id'),
    getManagedUserIds(user)
  ]);
  return {
    $or: [
      { lead: { $in: leadIds } },
      { lead: { $exists: false }, user: { $in: userIds } }
    ]
  };
};

const getAccessibleActivity = async (id, user) => {
  const activity = await populateActivity(Activity.findOne({ _id: id, ...(await getActivityScope(user)) }));
  if (!activity) throw new ApiError(404, 'Activity not found');
  return activity;
};

export const getActivities = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 30 });
  const filter = await getActivityScope(req.user);
  for (const field of ['lead', 'project', 'propertyUnit', 'siteVisit', 'booking', 'task', 'user', 'type', 'channel']) {
    if (req.query[field]) filter[field] = req.query[field];
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  const [activities, total] = await Promise.all([
    populateActivity(Activity.find(filter).sort('-createdAt').skip(skip).limit(limit)),
    Activity.countDocuments(filter)
  ]);
  return sendSuccess(res, { data: activities, pagination: paginationMeta(page, limit, total) });
};

export const getActivity = async (req, res) => sendSuccess(res, {
  data: await getAccessibleActivity(req.params.id, req.user)
});

export const createActivity = async (req, res) => {
  if (req.body.lead) {
    const lead = await Lead.findOne({ _id: req.body.lead, ...(await buildAssignmentFilter(req.user)) });
    if (!lead) throw new ApiError(404, 'Accessible lead not found');
    if (req.body.type === 'Note') {
      lead.notes.push({ text: req.body.description, createdBy: req.user._id });
      await lead.save();
    }
  }
  const payload = Object.fromEntries(
    editableFields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]])
  );
  const activity = await Activity.create({ ...payload, user: req.user._id });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Activity created successfully',
    data: await populateActivity(Activity.findById(activity._id))
  });
};

export const updateActivity = async (req, res) => {
  const activity = await getAccessibleActivity(req.params.id, req.user);
  if (!isAdmin(req.user) && String(activity.user._id) !== String(req.user._id)) {
    throw new ApiError(403, 'You can only edit your own activity');
  }
  for (const field of editableFields) {
    if (req.body[field] !== undefined) activity[field] = req.body[field];
  }
  await activity.save();
  return sendSuccess(res, {
    message: 'Activity updated successfully',
    data: await populateActivity(Activity.findById(activity._id))
  });
};

export const deleteActivity = async (req, res) => {
  const activity = await getAccessibleActivity(req.params.id, req.user);
  if (!isAdmin(req.user) && String(activity.user._id) !== String(req.user._id)) {
    throw new ApiError(403, 'You can only delete your own activity');
  }
  await activity.deleteOne();
  return sendSuccess(res, { message: 'Activity deleted successfully' });
};
