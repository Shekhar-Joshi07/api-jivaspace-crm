import mongoose from '../config/mongoose.js';

export const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Cancelled', 'Converted to Sale'];
export const PAYMENT_MODES = ['Cash', 'Cheque', 'Bank Transfer', 'UPI', 'Card', 'Other'];

const bookingSchema = new mongoose.Schema(
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
    propertyUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PropertyUnit',
      required: [true, 'Property unit is required'],
      index: true
    },
    bookingAmount: {
      type: Number,
      required: [true, 'Booking amount is required'],
      min: [0, 'Booking amount cannot be negative']
    },
    bookingDate: {
      type: Date,
      required: [true, 'Booking date is required'],
      default: Date.now,
      index: true
    },
    paymentMode: {
      type: String,
      enum: PAYMENT_MODES,
      default: 'Other',
      index: true
    },
    bookingStatus: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'Pending',
      index: true
    },
    documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
    remarks: { type: String, trim: true, maxlength: 3000 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // legacy compatibility
    bookingNumber: { type: String, trim: true, uppercase: true, maxlength: 50 },
    siteVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteVisit' },
    status: { type: String, enum: BOOKING_STATUSES, index: true },
    salePrice: { type: Number, min: 0 },
    tokenAmount: { type: Number, min: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    netAmount: { type: Number, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['Unpaid', 'Partially Paid', 'Paid', 'Refunded'],
      default: 'Unpaid'
    },
    paymentPlan: { type: String, trim: true, maxlength: 2000 },
    jointApplicants: [{
      name: { type: String, required: true, trim: true, maxlength: 150 },
      phone: { type: String, trim: true, maxlength: 20 },
      email: { type: String, lowercase: true, trim: true }
    }],
    notes: { type: String, trim: true, maxlength: 3000 },
    cancellationReason: { type: String, trim: true, maxlength: 1000 },
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

bookingSchema.index({ lead: 1, bookingDate: -1 });
bookingSchema.index({ project: 1, bookingDate: -1 });
bookingSchema.index({ propertyUnit: 1, bookingStatus: 1 });

bookingSchema.pre('validate', function syncLegacyFields() {
  if (!this.status && this.bookingStatus) this.status = this.bookingStatus;
  if (!this.bookingStatus && this.status) this.bookingStatus = this.status;
  if (this.bookingAmount != null) {
    if (this.salePrice == null) this.salePrice = this.bookingAmount;
    if (this.tokenAmount == null) this.tokenAmount = this.bookingAmount;
    if (this.netAmount == null) this.netAmount = this.bookingAmount;
  }
  if (this.status === 'Cancelled' || this.bookingStatus === 'Cancelled') {
    if (!this.cancelledAt) this.cancelledAt = new Date();
  }
});

export default mongoose.model('Booking', bookingSchema);
