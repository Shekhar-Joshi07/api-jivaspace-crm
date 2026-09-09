import mongoose from '../config/mongoose.js';

export const NOTIFICATION_TYPES = [
  'task_assigned',
  'task_due',
  'task_overdue',
  'lead_assigned',
  'lead_transferred',
  'follow_up',
  'site_visit',
  'booking',
  'payment',
  'status_changed',
  'general'
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1500, 'Message cannot exceed 1500 characters']
    },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'general', index: true },
    priority: { type: String, enum: ['Low', 'Normal', 'High'], default: 'Normal' },
    channels: [{
      type: String,
      enum: ['in_app', 'email', 'sms', 'push']
    }],
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date,
    actionUrl: { type: String, trim: true, maxlength: 500 },
    relatedLead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    relatedProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    relatedPropertyUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyUnit' },
    relatedSiteVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteVisit' },
    relatedBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    relatedTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: Date
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

notificationSchema.pre('save', function maintainReadTimestamp() {
  if (this.isModified('isRead')) {
    if (this.isRead && !this.readAt) this.readAt = new Date();
    if (!this.isRead) this.readAt = undefined;
  }
});

export default mongoose.model('Notification', notificationSchema);
