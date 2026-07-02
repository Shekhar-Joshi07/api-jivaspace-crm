import Lead from '../models/Lead.js';
import Notification from '../models/Notification.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { recordActivity } from '../services/activityService.js';
import { createNotification } from '../services/notificationService.js';
import {
  buildAssignmentFilter,
  canAccessAssignedRecord,
  getManagedUserIds,
  isAdmin,
  isBusinessExecutive
} from '../utils/accessControl.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const editableFields = [
  'title', 'description', 'type', 'status', 'priority', 'assignedTo', 'watchers',
  'relatedLead', 'lead', 'project', 'propertyUnit', 'siteVisit', 'booking',
  'dueDate', 'reminderAt', 'reminderSent', 'completionNote', 'cancellationReason'
];

const pick = body => Object.fromEntries(
  editableFields.filter(field => body[field] !== undefined)
    .map(field => [field, body[field] === '' ? undefined : body[field]])
);

const populateTask = query => query
  .populate('assignedTo watchers createdBy updatedBy', 'name email role')
  .populate('relatedLead lead', 'name phone email status assignedTo')
  .populate('project', 'name code')
  .populate('propertyUnit', 'unitNumber tower type status')
  .populate('siteVisit', 'scheduledAt status')
  .populate('booking', 'bookingNumber status');

const getAccessibleTask = async (id, user) => {
  const task = await populateTask(Task.findOne({ _id: id, ...(await buildAssignmentFilter(user)) }));
  if (!task) throw new ApiError(404, 'Task not found');
  return task;
};

const assertAssigneeAllowed = async (actor, assignedTo) => {
  const target = await User.findOne({ _id: assignedTo, isActive: true });
  if (!target) throw new ApiError(422, 'Assigned user not found');
  if (isAdmin(actor)) return;
  const ids = await getManagedUserIds(actor);
  if (!ids.some(id => String(id) === String(target._id))) {
    throw new ApiError(403, 'You can only assign tasks within your reporting team');
  }
};

const assertLeadAllowed = async (actor, leadId) => {
  if (!leadId) return;
  const lead = await Lead.findById(leadId);
  if (!lead || !(await canAccessAssignedRecord(actor, lead.assignedTo))) {
    throw new ApiError(404, 'Accessible related lead not found');
  }
};

export const getTasks = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = await buildAssignmentFilter(req.user);
  for (const field of ['status', 'priority', 'type', 'assignedTo', 'project', 'booking']) {
    if (req.query[field]) filter[field] = req.query[field];
  }
  if (req.query.relatedLead) filter.$or = [
    { relatedLead: req.query.relatedLead },
    { lead: req.query.relatedLead }
  ];
  if (req.query.overdue === 'true') {
    filter.dueDate = { $lt: new Date() };
    filter.status = { $nin: ['Completed', 'Cancelled'] };
  } else if (req.query.from || req.query.to) {
    filter.dueDate = {};
    if (req.query.from) filter.dueDate.$gte = new Date(req.query.from);
    if (req.query.to) filter.dueDate.$lte = new Date(req.query.to);
  }
  const [tasks, total] = await Promise.all([
    populateTask(Task.find(filter).sort({ dueDate: 1, priority: -1 }).skip(skip).limit(limit)),
    Task.countDocuments(filter)
  ]);
  return sendSuccess(res, { data: tasks, pagination: paginationMeta(page, limit, total) });
};

export const getTask = async (req, res) => sendSuccess(res, {
  data: await getAccessibleTask(req.params.id, req.user)
});

export const createTask = async (req, res) => {
  const payload = pick(req.body);
  if (isBusinessExecutive(req.user) || !payload.assignedTo) payload.assignedTo = req.user._id;
  const leadId = payload.relatedLead || payload.lead;
  await Promise.all([
    assertAssigneeAllowed(req.user, payload.assignedTo),
    assertLeadAllowed(req.user, leadId)
  ]);
  const task = await Task.create({ ...payload, createdBy: req.user._id });
  await Promise.all([
    recordActivity({
      lead: leadId, project: task.project, propertyUnit: task.propertyUnit,
      siteVisit: task.siteVisit, booking: task.booking, task: task._id,
      user: req.user._id, type: 'Task Created', description: `Created task: ${task.title}`
    }),
    String(task.assignedTo) === String(req.user._id) ? null : createNotification({
      user: task.assignedTo, title: 'New task assigned', message: task.title,
      type: 'task_assigned', relatedLead: leadId, relatedProject: task.project,
      relatedPropertyUnit: task.propertyUnit, relatedSiteVisit: task.siteVisit,
      relatedBooking: task.booking, relatedTask: task._id
    })
  ]);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Task created successfully',
    data: await populateTask(Task.findById(task._id))
  });
};

export const updateTask = async (req, res) => {
  const task = await getAccessibleTask(req.params.id, req.user);
  const payload = pick(req.body);
  if (isBusinessExecutive(req.user)) delete payload.assignedTo;
  if (payload.assignedTo) await assertAssigneeAllowed(req.user, payload.assignedTo);
  await assertLeadAllowed(req.user, payload.relatedLead || payload.lead);
  const oldAssignee = String(task.assignedTo?._id || task.assignedTo);
  const oldStatus = task.status;
  task.set({ ...payload, updatedBy: req.user._id });
  await task.save();
  const leadId = task.relatedLead?._id || task.relatedLead || task.lead?._id || task.lead;
  const operations = [recordActivity({
    lead: leadId, task: task._id, user: req.user._id, type: 'Task Update',
    description: `Updated task: ${task.title}`,
    metadata: { fromStatus: oldStatus, toStatus: task.status, fields: Object.keys(payload) }
  })];
  if (payload.assignedTo && oldAssignee !== String(task.assignedTo)) operations.push(createNotification({
    user: task.assignedTo, title: 'Task assigned', message: task.title,
    type: 'task_assigned', relatedLead: leadId, relatedTask: task._id
  }));
  await Promise.all(operations);
  return sendSuccess(res, {
    message: 'Task updated successfully',
    data: await populateTask(Task.findById(task._id))
  });
};

export const deleteTask = async (req, res) => {
  const task = await getAccessibleTask(req.params.id, req.user);
  await Promise.all([
    task.deleteOne(),
    Notification.deleteMany({ relatedTask: task._id }),
    recordActivity({
      lead: task.relatedLead?._id || task.relatedLead || task.lead?._id || task.lead,
      task: task._id, user: req.user._id, type: 'Task Update',
      description: `Deleted task: ${task.title}`
    })
  ]);
  return sendSuccess(res, { message: 'Task deleted successfully' });
};
