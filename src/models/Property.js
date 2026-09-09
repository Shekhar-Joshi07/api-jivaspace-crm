import mongoose from '../config/mongoose.js';
import { PROPERTY_TYPES } from '../utils/propertyTypes.js';
const propertySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  slug: { type: String, trim: true, lowercase: true, maxlength: 220, unique: true, sparse: true },
  type: { type: String, enum: PROPERTY_TYPES, required: true },
  location: { type: String, required: true, trim: true, maxlength: 300 },
  price: { type: Number, required: true, min: 0 },
  startFrom: { type: String, trim: true, maxlength: 100 },
  size: { type: String, trim: true, maxlength: 100 },
  bedrooms: { type: Number, min: 0 },
  status: { type: String, enum: ['Available','Sold','Booked','Hold'], default: 'Available' },
  description: { type: String, trim: true, maxlength: 5000 },
  logoUrl: { type: String, trim: true, maxlength: 1000 },
  heroImage: { type: String, trim: true, maxlength: 1000 },
  heroHeadline: { type: String, trim: true, maxlength: 200 },
  heroSubheadline: { type: String, trim: true, maxlength: 200 },
  units: [{
    title: { type: String, trim: true, maxlength: 100 },
    area: { type: String, trim: true, maxlength: 100 },
    price: { type: String, trim: true, maxlength: 100 }
  }],
  images: [{ type: String, trim: true, maxlength: 1000 }],
  amenities: [{ type: String, trim: true, maxlength: 100 }],
  highlights: [{ type: String, trim: true, maxlength: 200 }],
  floorPlans: [{ type: String, trim: true, maxlength: 200 }],
  nearbyPlaces: [{ type: String, trim: true, maxlength: 200 }],
  isPublished: { type: Boolean, default: false, index: true },
  isFeatured: { type: Boolean, default: false, index: true },
  ownerName: { type: String, trim: true, maxlength: 100 },
  ownerPhone: { type: String, trim: true, maxlength: 20 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

propertySchema.index({ isPublished: 1, isFeatured: -1, createdAt: -1 });
propertySchema.index({ title: 'text', location: 'text', description: 'text' });

export default mongoose.model('Property', propertySchema);
