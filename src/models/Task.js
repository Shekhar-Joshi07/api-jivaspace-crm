import mongoose from 'mongoose';

export const TASK_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
export const TASK_TYPES = [
  'Call',
  'Follow-up',
  'Meeting',
  'Site Visit',
  'Document Collection',
  'Payment Follow-up',
  'Other'
];

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: { type: String, trim: true, maxlength: 5000 },
    type: { type: String, enum: TASK_TYPES, default: 'Follow-up', index: true },
    status: { type: String, enum: TASK_STATUSES, default: 'Pending', index: true },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
      index: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned user is required'],
      index: true
    },
    watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    relatedLead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    propertyUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyUnit' },
    siteVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteVisit' },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    dueDate: { type: Date, required: [true, 'Due date is required'], index: true },
    reminderAt: Date,
    reminderSent: { type: Boolean, default: false },
    completedAt: Date,
    completionNote: { type: String, trim: true, maxlength: 2000 },
    cancellationReason: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

taskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
taskSchema.index({ relatedLead: 1, status: 1 });
taskSchema.index({ project: 1, status: 1 });

taskSchema.pre('validate', function synchronizeTaskFields() {
  if (this.relatedLead && !this.lead) this.lead = this.relatedLead;
  if (this.lead && !this.relatedLead) this.relatedLead = this.lead;
  if (this.status === 'Completed' && !this.completedAt) this.completedAt = new Date();
  if (this.status !== 'Completed') this.completedAt = undefined;
});

taskSchema.virtual('isOverdue').get(function isOverdue() {
  return !['Completed', 'Cancelled'].includes(this.status) && this.dueDate < new Date();
});

taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

export default mongoose.model('Task', taskSchema);
