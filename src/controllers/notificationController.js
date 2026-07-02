import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { getManagedUserIds, isAdmin } from '../utils/accessControl.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const populateNotification = query => query
  .populate('user createdBy', 'name email role')
  .populate('relatedLead', 'name phone status')
  .populate('relatedProject', 'name code')
  .populate('relatedPropertyUnit', 'unitNumber tower type')
  .populate('relatedSiteVisit', 'scheduledAt status')
  .populate('relatedBooking', 'bookingNumber status')
  .populate('relatedTask', 'title status dueDate');

const getOwnedNotification = async (id, user) => {
  const notification = await populateNotification(Notification.findOne({ _id: id, user: user._id }));
  if (!notification) throw new ApiError(404, 'Notification not found');
  return notification;
};

export const getNotifications = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { user: req.user._id };
  if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';
  if (req.query.type) filter.type = req.query.type;
  if (req.query.priority) filter.priority = req.query.priority;
  const [notifications, total, unread] = await Promise.all([
    populateNotification(Notification.find(filter).sort('-createdAt').skip(skip).limit(limit)),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false })
  ]);
  return sendSuccess(res, {
    data: notifications,
    pagination: paginationMeta(page, limit, total),
    meta: { unread }
  });
};

export const getNotification = async (req, res) => sendSuccess(res, {
  data: await getOwnedNotification(req.params.id, req.user)
});

export const createNotification = async (req, res) => {
  const recipient = await User.findOne({ _id: req.body.user, isActive: true });
  if (!recipient) throw new ApiError(422, 'Active notification recipient not found');
  if (!isAdmin(req.user)) {
    const ids = await getManagedUserIds(req.user);
    if (!ids.some(id => String(id) === String(recipient._id))) {
      throw new ApiError(403, 'You can only notify users in your reporting team');
    }
  }
  const notification = await Notification.create({ ...req.body, createdBy: req.user._id });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Notification created successfully',
    data: await populateNotification(Notification.findById(notification._id))
  });
};

export const updateNotification = async (req, res) => {
  const notification = await getOwnedNotification(req.params.id, req.user);
  const allowed = ['isRead', 'title', 'message', 'priority', 'actionUrl', 'expiresAt'];
  for (const field of allowed) {
    if (req.body[field] !== undefined) notification[field] = req.body[field];
  }
  await notification.save();
  return sendSuccess(res, {
    message: 'Notification updated successfully',
    data: notification
  });
};

export const getUnreadCount = async (req, res) => sendSuccess(res, {
  data: { count: await Notification.countDocuments({ user: req.user._id, isRead: false }) }
});

export const markAsRead = async (req, res) => {
  req.body.isRead = true;
  return updateNotification(req, res);
};

export const markAllAsRead = async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return sendSuccess(res, {
    message: 'All notifications marked as read',
    data: { updated: result.modifiedCount }
  });
};

export const deleteNotification = async (req, res) => {
  const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!notification) throw new ApiError(404, 'Notification not found');
  return sendSuccess(res, { message: 'Notification deleted successfully' });
};
