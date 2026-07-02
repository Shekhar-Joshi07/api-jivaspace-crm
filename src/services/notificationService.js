import Notification from '../models/Notification.js';

export const createNotification = async ({
  user,
  title,
  message,
  type = 'general',
  relatedLead,
  relatedProject,
  relatedPropertyUnit,
  relatedSiteVisit,
  relatedBooking,
  relatedTask
}) => {
  if (!user) return null;
  return Notification.create({
    user,
    title,
    message,
    type,
    relatedLead,
    relatedProject,
    relatedPropertyUnit,
    relatedSiteVisit,
    relatedBooking,
    relatedTask
  });
};

export const createNotifications = async (notifications) => {
  const validNotifications = notifications.filter(item => item.user);
  if (!validNotifications.length) return [];
  return Notification.insertMany(validNotifications);
};
