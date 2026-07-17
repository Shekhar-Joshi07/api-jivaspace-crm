import Property from '../models/Property.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const publicProperty = property => ({
  id: property._id,
  slug: property.slug || null,
  title: property.title,
  name: property.title,
  type: property.type,
  location: property.location,
  price: property.price,
  startFrom: property.startFrom || null,
  size: property.size || null,
  bedrooms: property.bedrooms ?? null,
  status: property.status,
  description: property.description || '',
  logoUrl: property.logoUrl || null,
  heroImage: property.heroImage || property.images?.[0] || null,
  heroHeadline: property.heroHeadline || null,
  heroSubheadline: property.heroSubheadline || null,
  units: property.units || [],
  images: property.images || [],
  galleryImages: property.images || [],
  amenities: property.amenities || [],
  highlights: property.highlights || [],
  floorPlans: property.floorPlans || [],
  nearbyPlaces: property.nearbyPlaces || [],
  isFeatured: !!property.isFeatured,
  createdAt: property.createdAt
});

export const getProperties = async (_req, res) => sendSuccess(res, {
  data: await Property.find().sort('-createdAt')
});

export const getPublicProperties = async (req, res) => {
  const filter = { isPublished: true };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.location) filter.location = new RegExp(escapeRegExp(req.query.location), 'i');
  if (req.query.search) {
    const search = new RegExp(escapeRegExp(req.query.search), 'i');
    filter.$or = [{ title: search }, { location: search }, { description: search }];
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);
  const properties = await Property.find(filter).sort({ isFeatured: -1, createdAt: -1 }).limit(limit);
  return sendSuccess(res, { data: properties.map(publicProperty) });
};

export const uploadPropertyImages = async (req, res) => {
  if (!req.files?.length) throw new ApiError(400, 'Select at least one image');
  const apiBaseUrl = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Property images uploaded successfully',
    data: req.files.map(file => ({
      name: file.originalname,
      url: `${apiBaseUrl}/uploads/property-images/${file.filename}`
    }))
  });
};

export const createProperty = async (req, res) => sendSuccess(res, {
  statusCode: 201,
  message: 'Property created successfully',
  data: await Property.create({ ...req.body, createdBy: req.user._id })
});

export const updateProperty = async (req, res) => {
  const property = await Property.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!property) throw new ApiError(404, 'Property not found');
  return sendSuccess(res, { message: 'Property updated successfully', data: property });
};

export const deleteProperty = async (req, res) => {
  const property = await Property.findByIdAndDelete(req.params.id);
  if (!property) throw new ApiError(404, 'Property not found');
  return sendSuccess(res, { message: 'Property deleted successfully' });
};
