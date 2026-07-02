import Booking from '../models/Booking.js';
import Project from '../models/Project.js';
import PropertyUnit, { AVAILABILITY_STATUSES, PROPERTY_UNIT_BHK } from '../models/PropertyUnit.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pick = body => {
  const payload = {};
  const fields = [
    'project',
    'unitNumber',
    'towerBlock',
    'floor',
    'bhk',
    'areaSqft',
    'facing',
    'price',
    'availabilityStatus',
    'description',
    'isActive',
    'tower',
    'block',
    'type',
    'configuration',
    'bedrooms',
    'bathrooms',
    'balconies',
    'carpetArea',
    'builtUpArea',
    'superBuiltUpArea',
    'areaUnit',
    'furnishing',
    'basePrice',
    'floorRiseCharge',
    'parkingCharge',
    'otherCharges',
    'totalPrice',
    'status',
    'holdUntil',
    'holdForLead',
    'currentBooking',
    'features'
  ];
  for (const field of fields) {
    if (body[field] !== undefined) payload[field] = body[field];
  }
  return payload;
};

const normalizeUnit = body => {
  const payload = pick(body);
  if (!payload.towerBlock && body.tower) payload.towerBlock = body.tower;
  if (!payload.tower && payload.towerBlock) payload.tower = payload.towerBlock;
  if (!payload.price && body.basePrice != null) payload.price = body.basePrice;
  if (!payload.basePrice && payload.price != null) payload.basePrice = payload.price;
  if (!payload.availabilityStatus && body.status) payload.availabilityStatus = body.status;
  if (!payload.status && payload.availabilityStatus) payload.status = payload.availabilityStatus;
  if (payload.features && !Array.isArray(payload.features)) payload.features = [payload.features].flat();
  return payload;
};

const populateUnit = query => query
  .populate('project', 'projectName builderName location propertyType status')
  .populate('holdForLead', 'name phone status')
  .populate('currentBooking', 'bookingNumber status')
  .populate('createdBy updatedBy', 'name email role employeeId');

const formatUnit = unit => {
  const obj = typeof unit?.toObject === 'function' ? unit.toObject() : unit;
  return {
    id: obj._id,
    project: obj.project,
    unitNumber: obj.unitNumber,
    towerBlock: obj.towerBlock || obj.tower || '',
    floor: obj.floor ?? null,
    bhk: obj.bhk || obj.configuration || null,
    areaSqft: obj.areaSqft ?? obj.builtUpArea ?? obj.carpetArea ?? null,
    facing: obj.facing || null,
    price: obj.price ?? obj.basePrice ?? null,
    availabilityStatus: obj.availabilityStatus || obj.status,
    description: obj.description || '',
    isActive: !!obj.isActive,
    createdBy: obj.createdBy || null,
    updatedBy: obj.updatedBy || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    legacy: {
      tower: obj.tower || null,
      block: obj.block || null,
      type: obj.type || null,
      configuration: obj.configuration || null,
      bedrooms: obj.bedrooms ?? null,
      bathrooms: obj.bathrooms ?? null,
      balconies: obj.balconies ?? null,
      carpetArea: obj.carpetArea ?? null,
      builtUpArea: obj.builtUpArea ?? null,
      superBuiltUpArea: obj.superBuiltUpArea ?? null,
      areaUnit: obj.areaUnit || null,
      furnishing: obj.furnishing || null
    }
  };
};

export const getPropertyUnits = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.query.project) filter.project = req.query.project;
  if (req.query.availabilityStatus || req.query.status) filter.availabilityStatus = req.query.availabilityStatus || req.query.status;
  if (req.query.bhk) filter.bhk = req.query.bhk;
  if (req.query.facing) filter.facing = req.query.facing;
  if (req.query.floor !== undefined) filter.floor = Number(req.query.floor);
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.search) {
    const search = new RegExp(escapeRegExp(req.query.search), 'i');
    filter.$or = [{ unitNumber: search }, { towerBlock: search }];
  }
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
  }

  const [units, total] = await Promise.all([
    populateUnit(PropertyUnit.find(filter).sort({ project: 1, towerBlock: 1, floor: 1, unitNumber: 1 })
      .skip(skip).limit(limit)),
    PropertyUnit.countDocuments(filter)
  ]);

  return sendSuccess(res, {
    data: units.map(formatUnit),
    pagination: paginationMeta(page, limit, total)
  });
};

export const getPropertyUnit = async (req, res) => {
  const unit = await populateUnit(PropertyUnit.findById(req.params.id));
  if (!unit) throw new ApiError(404, 'Property unit not found');
  return sendSuccess(res, { data: formatUnit(unit) });
};

export const createPropertyUnit = async (req, res) => {
  if (!(await Project.exists({ _id: req.body.project, isActive: true }))) {
    throw new ApiError(422, 'Active project not found');
  }

  const payload = normalizeUnit(req.body);
  const unit = await PropertyUnit.create({ ...payload, createdBy: req.user._id });
  const created = await populateUnit(PropertyUnit.findById(unit._id));
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Property unit created successfully',
    data: formatUnit(created)
  });
};

export const updatePropertyUnit = async (req, res) => {
  const unit = await PropertyUnit.findById(req.params.id);
  if (!unit) throw new ApiError(404, 'Property unit not found');

  if (req.body.project && !(await Project.exists({ _id: req.body.project, isActive: true }))) {
    throw new ApiError(422, 'Active project not found');
  }

  const payload = normalizeUnit(req.body);
  unit.set({ ...payload, updatedBy: req.user._id });
  await unit.save();

  const updated = await populateUnit(PropertyUnit.findById(unit._id));
  return sendSuccess(res, {
    message: 'Property unit updated successfully',
    data: formatUnit(updated)
  });
};

export const deletePropertyUnit = async (req, res) => {
  const unit = await PropertyUnit.findById(req.params.id);
  if (!unit) throw new ApiError(404, 'Property unit not found');

  if (await Booking.exists({ propertyUnit: unit._id, status: { $nin: ['Cancelled', 'Refunded'] } })) {
    throw new ApiError(409, 'Property unit has an active booking and cannot be deleted');
  }

  await unit.deleteOne();
  return sendSuccess(res, { message: 'Property unit deleted successfully' });
};

export const getInventoryEnums = async (_req, res) => sendSuccess(res, {
  data: {
    availabilityStatuses: AVAILABILITY_STATUSES,
    bhk: PROPERTY_UNIT_BHK
  }
});
