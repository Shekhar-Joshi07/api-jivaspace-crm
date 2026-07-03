import mongoose from '../config/mongoose.js';

export const LEAD_STATUSES = [
  'New',
  'Calling',
  'Face to Face',
  'Site Visit',
  'Follow-up Needed',
  'Negotiation',
  'Booking Done',
  'Closure',
  'Not Interested',
  'Lost'
];

export const LEAD_SOURCES = [
  'Website',
  'Facebook',
  'Instagram',
  'Google Ads',
  '99acres',
  'MagicBricks',
  'Housing.com',
  'Referral',
  'Walk-in',
  'Outbound Call',
  'Channel Partner',
  'Other'
];

const noteSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Note text is required'],
      trim: true,
      maxlength: [5000, 'Note cannot exceed 5000 characters']
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    from: { type: String, enum: LEAD_STATUSES },
    to: { type: String, enum: LEAD_STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, trim: true, maxlength: 1000 },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Lead name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
      index: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address']
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
      maxlength: [20, 'Phone cannot exceed 20 characters'],
      index: true
    },
    alternatePhone: { type: String, trim: true, maxlength: 20 },
    source: { type: String, enum: LEAD_SOURCES, default: 'Other', index: true },
    sourceDetails: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: LEAD_STATUSES, default: 'New', index: true },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Hot'],
      default: 'Medium',
      index: true
    },
    purpose: {
      type: String,
      enum: ['Buy', 'Rent', 'Investment'],
      default: 'Buy'
    },
    propertyType: {
      type: String,
      enum: ['Apartment', 'Villa', 'Plot', 'Builder Floor', 'Office', 'Shop', 'Warehouse', 'Other']
    },
    configuration: { type: String, trim: true, maxlength: 100 },
    budget: { type: Number, min: [0, 'Budget cannot be negative'] },
    budgetMax: { type: Number, min: [0, 'Maximum budget cannot be negative'] },
    preferredLocations: [{ type: String, trim: true }],
    preferredLocation: { type: String, trim: true, maxlength: 300 },
    requirement: { type: String, trim: true, maxlength: 3000 },
    remarks: { type: String, trim: true, maxlength: 5000 },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    interestedUnits: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PropertyUnit' }],
    interestedProperty: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyUnit' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: Date,
    lastContactedAt: Date,
    nextFollowUp: { type: Date, index: true },
    followUpDate: { type: Date, index: true },
    lostReason: { type: String, trim: true, maxlength: 1000 },
    notes: [noteSchema],
    statusHistory: [statusHistorySchema],
    estimatedValue: { type: Number, min: 0, default: 0 },
    revenue: { type: Number, min: 0, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isArchived: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

leadSchema.index({ status: 1, assignedTo: 1, nextFollowUp: 1 });
leadSchema.index({ project: 1, status: 1 });
leadSchema.index({ createdAt: -1, source: 1 });
leadSchema.index({ name: 'text', email: 'text', phone: 'text' });

leadSchema.pre('validate', function synchronizeFollowUpFields() {
  if (this.followUpDate && !this.nextFollowUp) this.nextFollowUp = this.followUpDate;
  if (this.nextFollowUp && !this.followUpDate) this.followUpDate = this.nextFollowUp;
  if (this.budget != null && this.budgetMax != null && this.budgetMax < this.budget) {
    this.invalidate('budgetMax', 'Maximum budget must be greater than or equal to minimum budget');
  }
});

export default mongoose.model('Lead', leadSchema);
