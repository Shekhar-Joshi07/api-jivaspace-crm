import mongoose from '../config/mongoose.js';

export const AVAILABILITY_STATUSES = ['Available', 'Hold', 'Booked', 'Sold'];
export const PROPERTY_UNIT_BHK = ['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK', 'Studio', 'Duplex', 'Penthouse', 'Other'];

const propertyUnitSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
      index: true
    },
    unitNumber: {
      type: String,
      required: [true, 'Unit number is required'],
      trim: true,
      uppercase: true,
      maxlength: [50, 'Unit number cannot exceed 50 characters']
    },
    towerBlock: { type: String, trim: true, uppercase: true, maxlength: 50 },
    floor: { type: Number, min: [0, 'Floor cannot be negative'] },
    bhk: { type: String, enum: PROPERTY_UNIT_BHK, default: 'Other', index: true },
    areaSqft: { type: Number, min: [0, 'Area cannot be negative'] },
    facing: {
      type: String,
      enum: ['North', 'South', 'East', 'West', 'North East', 'North West', 'South East', 'South West']
    },
    price: { type: Number, required: [true, 'Price is required'], min: [0, 'Price cannot be negative'] },
    availabilityStatus: {
      type: String,
      enum: AVAILABILITY_STATUSES,
      default: 'Available',
      index: true
    },
    description: { type: String, trim: true, maxlength: 3000 },
    tower: { type: String, trim: true, uppercase: true, maxlength: 50, default: '' },
    block: { type: String, trim: true, uppercase: true, maxlength: 50 },
    type: { type: String, trim: true, maxlength: 100 },
    configuration: { type: String, trim: true, maxlength: 100 },
    bedrooms: { type: Number, min: 0 },
    bathrooms: { type: Number, min: 0 },
    balconies: { type: Number, min: 0 },
    carpetArea: { type: Number, min: 0 },
    builtUpArea: { type: Number, min: 0 },
    superBuiltUpArea: { type: Number, min: 0 },
    areaUnit: { type: String, enum: ['sq_ft', 'sq_m', 'sq_yd'], default: 'sq_ft' },
    furnishing: {
      type: String,
      enum: ['Unfurnished', 'Semi Furnished', 'Fully Furnished'],
      default: 'Unfurnished'
    },
    basePrice: { type: Number, min: [0, 'Base price cannot be negative'] },
    floorRiseCharge: { type: Number, min: 0, default: 0 },
    parkingCharge: { type: Number, min: 0, default: 0 },
    otherCharges: { type: Number, min: 0, default: 0 },
    totalPrice: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    status: { type: String, enum: AVAILABILITY_STATUSES, default: 'Available', index: true },
    holdUntil: Date,
    holdForLead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    currentBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    features: [{ type: String, trim: true, maxlength: 100 }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

propertyUnitSchema.index({ project: 1, towerBlock: 1, unitNumber: 1 }, { unique: true });
propertyUnitSchema.index({ project: 1, availabilityStatus: 1, bhk: 1 });
propertyUnitSchema.index({ price: 1, floor: 1 });

propertyUnitSchema.pre('validate', function syncLegacyFields() {
  if (!this.towerBlock && this.tower) this.towerBlock = this.tower;
  if (!this.tower && this.towerBlock) this.tower = this.towerBlock;
  if (!this.price && this.basePrice != null) this.price = this.basePrice;
  if (!this.basePrice && this.price != null) this.basePrice = this.price;
  if (!this.availabilityStatus && this.status) this.availabilityStatus = this.status;
  if (!this.status && this.availabilityStatus) this.status = this.availabilityStatus;
  if (!this.description && this.features?.length) this.description = this.features.join(', ');
  if (this.availabilityStatus !== 'Hold') {
    this.holdUntil = undefined;
    this.holdForLead = undefined;
  }
});

export default mongoose.model('PropertyUnit', propertyUnitSchema);
