import mongoose from 'mongoose';

const leadTransferLogSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: [true, 'Lead is required'],
      index: true
    },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiving user is required'],
      index: true
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Transferring user is required'],
      index: true
    },
    transferType: {
      type: String,
      enum: ['Assignment', 'Transfer', 'Reassignment', 'Auto Assignment'],
      default: 'Transfer'
    },
    reason: {
      type: String,
      required: [true, 'Transfer reason is required'],
      trim: true,
      maxlength: [1000, 'Transfer reason cannot exceed 1000 characters']
    },
    previousStatus: { type: String, trim: true, maxlength: 100 },
    previousNextFollowUp: Date,
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    acknowledgedAt: Date,
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true, versionKey: false }
);

leadTransferLogSchema.index({ lead: 1, createdAt: -1 });
leadTransferLogSchema.index({ toUser: 1, createdAt: -1 });
leadTransferLogSchema.index({ transferredBy: 1, createdAt: -1 });

leadTransferLogSchema.pre('validate', function validateTransferUsers() {
  if (this.fromUser && String(this.fromUser) === String(this.toUser)) {
    this.invalidate('toUser', 'Source and destination users must be different');
  }
});

export default mongoose.model('LeadTransferLog', leadTransferLogSchema);
