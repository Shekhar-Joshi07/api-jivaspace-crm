import mongoose from '../config/mongoose.js';

export const SITE_VISIT_STATUSES = [
  'Scheduled',
  'Completed',
  'Cancelled',
  'Rescheduled',
  'No Show'
];

const siteVisitSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: [true, 'Lead is required'],
      index: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
      index: true
    },
    visitDate: {
      type: Date,
      required: [true, 'Visit date is required'],
      index: true
    },
    visitTime: {
      type: String,
      trim: true,
      maxlength: [20, 'Visit time cannot exceed 20 characters']
    },
    assignedSalesPerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned sales person is required'],
      index: true
    },
    visitStatus: {
      type: String,
      enum: SITE_VISIT_STATUSES,
      default: 'Scheduled',
      index: true
    },
    customerFeedback: { type: String, trim: true, maxlength: 3000 },
    nextFollowUpDate: { type: Date, index: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // legacy compatibility
    scheduledAt: { type: Date },
    status: { type: String, enum: SITE_VISIT_STATUSES, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    feedback: { type: String, trim: true, maxlength: 3000 },
    nextFollowUpAt: { type: Date },
    cancellationReason: { type: String, trim: true, maxlength: 1000 },
    rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteVisit' },
    accompanyingUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    visitorCount: { type: Number, min: 1, default: 1 },
    pickupRequired: { type: Boolean, default: false },
    pickupAddress: { type: String, trim: true, maxlength: 500 },
    checkInAt: Date,
    checkOutAt: Date,
    outcome: {
      type: String,
      enum: ['Interested', 'Follow-up Required', 'Not Interested', 'Negotiation', 'Booked']
    }
  },
  { timestamps: true }
);

siteVisitSchema.index({ lead: 1, visitDate: -1 });
siteVisitSchema.index({ project: 1, visitDate: 1 });
siteVisitSchema.index({ assignedSalesPerson: 1, visitStatus: 1, visitDate: 1 });

siteVisitSchema.pre('validate', function syncLegacyFields() {
  if (!this.scheduledAt && this.visitDate) this.scheduledAt = this.visitDate;
  if (!this.visitDate && this.scheduledAt) this.visitDate = this.scheduledAt;
  if (!this.status && this.visitStatus) this.status = this.visitStatus;
  if (!this.visitStatus && this.status) this.visitStatus = this.status;
  if (!this.assignedTo && this.assignedSalesPerson) this.assignedTo = this.assignedSalesPerson;
  if (!this.assignedSalesPerson && this.assignedTo) this.assignedSalesPerson = this.assignedTo;
  if (!this.feedback && this.customerFeedback) this.feedback = this.customerFeedback;
  if (!this.customerFeedback && this.feedback) this.customerFeedback = this.feedback;
  if (!this.nextFollowUpAt && this.nextFollowUpDate) this.nextFollowUpAt = this.nextFollowUpDate;
  if (!this.nextFollowUpDate && this.nextFollowUpAt) this.nextFollowUpDate = this.nextFollowUpAt;
  if (!this.pickupRequired) this.pickupAddress = undefined;
  if (this.checkInAt && this.checkOutAt && this.checkOutAt < this.checkInAt) {
    this.invalidate('checkOutAt', 'Check-out time cannot be before check-in time');
  }
});

export default mongoose.model('SiteVisit', siteVisitSchema);
