import Property from '../models/Property.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const getProperties = async (_req, res) => sendSuccess(res, {
  data: await Property.find().sort('-createdAt')
});

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
