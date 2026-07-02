import mongoose from 'mongoose';

const communicationSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: String, enum: ['Email', 'SMS'], required: true, index: true },
    recipient: { type: String, required: true, trim: true },
    subject: { type: String, trim: true, maxlength: 300 },
    message: { type: String, required: true, maxlength: 10000 },
    status: { type: String, enum: ['Sent', 'Failed'], required: true },
    providerMessageId: String,
    error: String
  },
  { timestamps: true }
);

communicationSchema.index({ lead: 1, createdAt: -1 });

export default mongoose.model('Communication', communicationSchema);
