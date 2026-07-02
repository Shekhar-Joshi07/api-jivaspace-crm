import mongoose from 'mongoose';

export const PROJECT_STATUSES = ['Upcoming', 'Ongoing', 'Ready to Move', 'Sold Out'];
export const PROJECT_PROPERTY_TYPES = [
  'Apartment',
  'Villa',
  'Plot',
  'Builder Floor',
  'Office',
  'Shop',
  'Warehouse',
  'Other'
];

const projectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [200, 'Project name cannot exceed 200 characters'],
      index: true
    },
    builderName: {
      type: String,
      required: [true, 'Builder name is required'],
      trim: true,
      maxlength: [200, 'Builder name cannot exceed 200 characters'],
      index: true
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: [300, 'Location cannot exceed 300 characters'],
      index: true
    },
    propertyType: {
      type: String,
      enum: PROJECT_PROPERTY_TYPES,
      required: [true, 'Property type is required'],
      index: true
    },
    priceRange: {
      type: String,
      trim: true,
      maxlength: [120, 'Price range cannot exceed 120 characters']
    },
    totalUnits: { type: Number, min: [0, 'Total units cannot be negative'], default: 0 },
    availableUnits: { type: Number, min: [0, 'Available units cannot be negative'], default: 0 },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'Upcoming',
      index: true
    },
    amenities: [{ type: String, trim: true, maxlength: 100 }],
    description: { type: String, trim: true, maxlength: 10000 },
    brochure: { type: String, trim: true, maxlength: 1000 },
    images: [{ type: String, trim: true, maxlength: 1000 }],
    name: { type: String, trim: true, maxlength: 200 },
    code: { type: String, trim: true, uppercase: true, maxlength: 30 },
    developerName: { type: String, trim: true, maxlength: 200 },
    type: { type: String, enum: PROJECT_PROPERTY_TYPES, index: true },
    reraNumber: { type: String, trim: true, uppercase: true, maxlength: 100 },
    address: {
      line1: { type: String, trim: true, maxlength: 200 },
      line2: { type: String, trim: true, maxlength: 200 },
      locality: { type: String, trim: true, maxlength: 100 },
      city: { type: String, trim: true, maxlength: 100 },
      state: { type: String, trim: true, maxlength: 100 },
      postalCode: { type: String, trim: true, maxlength: 12 },
      country: { type: String, trim: true, default: 'India', maxlength: 100 }
    },
    geoLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] }
    },
    websiteUrl: { type: String, trim: true, maxlength: 1000 },
    contactPerson: {
      name: { type: String, trim: true, maxlength: 100 },
      phone: { type: String, trim: true, maxlength: 20 },
      email: { type: String, lowercase: true, trim: true }
    },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

projectSchema.index({ projectName: 'text', builderName: 'text', location: 'text', description: 'text' });
projectSchema.index({ propertyType: 1, status: 1, isActive: 1 });

projectSchema.pre('validate', function syncLegacyFields() {
  if (!this.projectName && this.name) this.projectName = this.name;
  if (!this.name && this.projectName) this.name = this.projectName;
  if (!this.builderName && this.developerName) this.builderName = this.developerName;
  if (!this.developerName && this.builderName) this.developerName = this.builderName;
  if (!this.propertyType && this.type) this.propertyType = this.type;
  if (!this.type && this.propertyType) this.type = this.propertyType;
  if (!this.brochure && this.brochureUrl) this.brochure = this.brochureUrl;
  if (!this.brochureUrl && this.brochure) this.brochureUrl = this.brochure;
  if (this.availableUnits != null && this.totalUnits != null && this.availableUnits > this.totalUnits) {
    this.invalidate('availableUnits', 'Available units cannot exceed total units');
  }
});

export default mongoose.model('Project', projectSchema);
