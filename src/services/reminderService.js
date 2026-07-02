import Lead from '../models/Lead.js';
import Notification from '../models/Notification.js';
import Task from '../models/Task.js';

export const generateReminders = async () => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [tasks, followUps] = await Promise.all([
    Task.find({
      status: { $nin: ['Completed', 'Cancelled'] },
      $or: [
        { reminderAt: { $lte: now }, reminderSent: false },
        { dueDate: { $lt: now } }
      ]
    }).select('title assignedTo relatedLead lead dueDate reminderAt reminderSent'),
    Lead.find({
      assignedTo: { $exists: true },
      status: { $nin: ['Closure', 'Not Interested', 'Lost'] },
      $or: [
        { followUpDate: { $gte: startOfDay, $lte: now } },
        { nextFollowUp: { $gte: startOfDay, $lte: now } }
      ]
    }).select('name assignedTo followUpDate nextFollowUp')
  ]);

  let created = 0;
  for (const task of tasks) {
    const isOverdue = task.dueDate < now;
    const type = isOverdue ? 'task_overdue' : 'task_assigned';
    const exists = await Notification.exists({
      user: task.assignedTo,
      relatedTask: task._id,
      type,
      createdAt: { $gte: startOfDay }
    });
    if (!exists) {
      await Notification.create({
        user: task.assignedTo,
        title: isOverdue ? 'Task overdue' : 'Task reminder',
        message: task.title,
        type,
        relatedLead: task.relatedLead || task.lead,
        relatedTask: task._id
      });
      created += 1;
    }
    if (!isOverdue && task.reminderAt && !task.reminderSent) {
      task.reminderSent = true;
      await task.save({ validateBeforeSave: false });
    }
  }

  for (const lead of followUps) {
    const exists = await Notification.exists({
      user: lead.assignedTo,
      relatedLead: lead._id,
      type: 'follow_up',
      createdAt: { $gte: startOfDay }
    });
    if (!exists) {
      await Notification.create({
        user: lead.assignedTo,
        title: 'Follow-up due',
        message: `Follow up with ${lead.name}`,
        type: 'follow_up',
        relatedLead: lead._id
      });
      created += 1;
    }
  }

  return { tasksChecked: tasks.length, followUpsChecked: followUps.length, notificationsCreated: created };
};
