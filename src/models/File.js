import mongoose from 'mongoose';

export const FILE_CATEGORIES = [
  'Lead Document',
  'Project Brochure',
  'Floor Plan',
  'KYC',
  'Booking Form',
  'Payment Receipt',
  'Agreement',
  'Image',
  'Other'
];

const fileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: [true, 'Original file name is required'],
      trim: true,
      maxlength: [255, 'File name cannot exceed 255 characters']
    },
    storedName: {
      type: String,
      required: [true, 'Stored file name is required'],
      unique: true,
      trim: true,
      maxlength: [255, 'Stored file name cannot exceed 255 characters']
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      trim: true,
      maxlength: [150, 'MIME type cannot exceed 150 characters']
    },
    extension: { type: String, lowercase: true, trim: true, maxlength: 20 },
    size: { type: Number, required: true, min: [0, 'File size cannot be negative'] },
    storageProvider: {
      type: String,
      enum: ['local', 's3', 'cloudinary', 'azure', 'gcs'],
      default: 'local'
    },
    path: { type: String, required: true, select: false },
    url: { type: String, required: true, trim: true },
    checksum: { type: String, trim: true, select: false },
    category: { type: String, enum: FILE_CATEGORIES, default: 'Other', index: true },
    visibility: { type: String, enum: ['Private', 'Internal', 'Public'], default: 'Private' },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    propertyUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyUnit' },
    siteVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteVisit' },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader is required'],
      index: true
    },
    description: { type: String, trim: true, maxlength: 1000 },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

fileSchema.index({ lead: 1, category: 1, createdAt: -1 });
fileSchema.index({ booking: 1, category: 1, createdAt: -1 });
fileSchema.index({ project: 1, category: 1, createdAt: -1 });

fileSchema.pre('validate', function validateAttachment() {
  const references = [this.lead, this.project, this.propertyUnit, this.siteVisit, this.booking];
  if (!references.some(Boolean)) {
    this.invalidate('lead', 'File must be attached to a lead, project, property unit, site visit, or booking');
  }
  if (this.isDeleted && !this.deletedAt) this.deletedAt = new Date();
});

export default mongoose.model('File', fileSchema);
