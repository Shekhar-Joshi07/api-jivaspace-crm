import Project, { PROJECT_PROPERTY_TYPES, PROJECT_STATUSES } from '../models/Project.js';
import PropertyUnit from '../models/PropertyUnit.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pick = body => {
  const payload = {};
  const fields = [
    'projectName',
    'builderName',
    'location',
    'propertyType',
    'priceRange',
    'totalUnits',
    'availableUnits',
    'status',
    'amenities',
    'description',
    'brochure',
    'images',
    'isActive',
    'name',
    'code',
    'developerName',
    'type',
    'reraNumber',
    'address',
    'geoLocation',
    'brochureUrl',
    'websiteUrl',
    'contactPerson'
  ];
  for (const field of fields) {
    if (body[field] !== undefined) payload[field] = body[field];
  }
  return payload;
};

const normalizeProject = body => {
  const payload = pick(body);
  if (!payload.projectName && body.name) payload.projectName = body.name;
  if (!payload.name && payload.projectName) payload.name = payload.projectName;
  if (!payload.builderName && body.developerName) payload.builderName = body.developerName;
  if (!payload.developerName && payload.builderName) payload.developerName = payload.builderName;
  if (!payload.propertyType && body.type) payload.propertyType = body.type;
  if (!payload.type && payload.propertyType) payload.type = payload.propertyType;
  if (!payload.brochure && body.brochureUrl) payload.brochure = body.brochureUrl;
  if (!payload.brochureUrl && payload.brochure) payload.brochureUrl = payload.brochure;
  if (payload.images && !Array.isArray(payload.images)) payload.images = [payload.images].flat();
  if (payload.amenities && !Array.isArray(payload.amenities)) payload.amenities = [payload.amenities].flat();
  return payload;
};

const populateProject = query => query.populate('createdBy updatedBy', 'name email role employeeId');

const formatProject = project => {
  const obj = typeof project?.toObject === 'function' ? project.toObject() : project;
  return {
    id: obj._id,
    projectName: obj.projectName || obj.name,
    builderName: obj.builderName || obj.developerName,
    location: obj.location || obj.address?.city || '',
    propertyType: obj.propertyType || obj.type,
    priceRange: obj.priceRange || null,
    totalUnits: obj.totalUnits ?? 0,
    availableUnits: obj.availableUnits ?? 0,
    status: obj.status,
    amenities: obj.amenities || [],
    description: obj.description || '',
    brochure: obj.brochure || obj.brochureUrl || null,
    images: obj.images || [],
    isActive: !!obj.isActive,
    createdBy: obj.createdBy || null,
    updatedBy: obj.updatedBy || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

export const getProjects = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.propertyType || req.query.type) filter.propertyType = req.query.propertyType || req.query.type;
  if (req.query.location) filter.location = new RegExp(escapeRegExp(req.query.location), 'i');
  if (req.query.builderName) filter.builderName = new RegExp(escapeRegExp(req.query.builderName), 'i');
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.search) {
    const search = new RegExp(escapeRegExp(req.query.search), 'i');
    filter.$or = [
      { projectName: search },
      { builderName: search },
      { location: search },
      { description: search }
    ];
  }

  const [projects, total] = await Promise.all([
    populateProject(Project.find(filter).sort('-createdAt').skip(skip).limit(limit)),
    Project.countDocuments(filter)
  ]);

  return sendSuccess(res, {
    data: projects.map(formatProject),
    pagination: paginationMeta(page, limit, total)
  });
};

export const getProject = async (req, res) => {
  const project = await populateProject(Project.findById(req.params.id));
  if (!project) throw new ApiError(404, 'Project not found');
  return sendSuccess(res, { data: formatProject(project) });
};

export const createProject = async (req, res) => {
  const payload = normalizeProject(req.body);
  if (payload.availableUnits != null && payload.totalUnits != null && payload.availableUnits > payload.totalUnits) {
    throw new ApiError(422, 'Available units cannot exceed total units');
  }
  const project = await Project.create({ ...payload, createdBy: req.user._id });
  const created = await populateProject(Project.findById(project._id));
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Project created successfully',
    data: formatProject(created)
  });
};

export const updateProject = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');

  const payload = normalizeProject(req.body);
  if (payload.availableUnits != null && payload.totalUnits != null && payload.availableUnits > payload.totalUnits) {
    throw new ApiError(422, 'Available units cannot exceed total units');
  }

  project.set({ ...payload, updatedBy: req.user._id });
  await project.save();

  const updated = await populateProject(Project.findById(project._id));
  return sendSuccess(res, {
    message: 'Project updated successfully',
    data: formatProject(updated)
  });
};

export const deleteProject = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');
  if (await PropertyUnit.exists({ project: project._id })) {
    throw new ApiError(409, 'Project cannot be deleted while property units exist');
  }
  await project.deleteOne();
  return sendSuccess(res, { message: 'Project deleted successfully' });
};

export const getProjectEnums = async (_req, res) => sendSuccess(res, {
  data: {
    statuses: PROJECT_STATUSES,
    propertyTypes: PROJECT_PROPERTY_TYPES
  }
});
