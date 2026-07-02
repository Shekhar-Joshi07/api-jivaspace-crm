import mongoose from 'mongoose';

export const ACTIVITY_TYPES = [
  'Lead Created',
  'Lead Updated',
  'Lead Assigned',
  'Lead Transferred',
  'Status Change',
  'Call',
  'Face to Face',
  'Follow-up',
  'Note',
  'Site Visit Scheduled',
  'Site Visit Completed',
  'Booking Created',
  'Booking Updated',
  'Task Created',
  'Task Update',
  'File Upload',
  'File Deleted',
  'Email',
  'SMS',
  'WhatsApp',
  'System'
];

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true, index: true },
    description: {
      type: String,
      required: [true, 'Activity description is required'],
      trim: true,
      maxlength: [3000, 'Activity description cannot exceed 3000 characters']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Activity user is required'],
      index: true
    },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    propertyUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyUnit' },
    siteVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteVisit' },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
    channel: {
      type: String,
      enum: ['Call', 'Email', 'SMS', 'WhatsApp', 'In Person', 'System']
    },
    direction: { type: String, enum: ['Inbound', 'Outbound', 'Internal'] },
    outcome: { type: String, trim: true, maxlength: 500 },
    durationSeconds: { type: Number, min: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true, maxlength: 64 },
    userAgent: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

activitySchema.index({ lead: 1, createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ booking: 1, createdAt: -1 });
activitySchema.index({ project: 1, createdAt: -1 });

export default mongoose.model('Activity', activitySchema);
