import User from '../models/User.js';
import { getManagedUserIds, isAdmin, isSuperAdmin } from '../utils/accessControl.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const editableFields = [
  'name', 'employeeId', 'phone', 'role', 'reportingManager', 'avatarUrl',
  'isActive', 'password'
];

const getUserScope = async actor => {
  const ids = await getManagedUserIds(actor);
  return ids ? { _id: { $in: ids } } : {};
};

const populateUser = query => query
  .populate('reportingManager', 'name email role employeeId')
  .populate('createdBy updatedBy', 'name email role');

const assertRoleAllowed = (actor, role) => {
  if (!role) return;
  if (role === 'superadmin' && !isSuperAdmin(actor)) {
    throw new ApiError(403, 'Only a Super Admin can assign the Super Admin role');
  }
};

const assertManagerExists = async reportingManager => {
  if (!reportingManager) return;
  const manager = await User.findOne({
    _id: reportingManager,
    role: { $in: ['superadmin', 'admin'] },
    isActive: true
  });
  if (!manager) throw new ApiError(422, 'Active reporting manager not found');
};

export const getUsers = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = await getUserScope(req.user);
  if (req.query.role) filter.role = req.query.role;
  if (req.query.reportingManager) filter.reportingManager = req.query.reportingManager;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.search) {
    const search = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['name', 'email', 'phone', 'employeeId']
      .map(field => ({ [field]: new RegExp(search, 'i') }));
  }
  const [users, total] = await Promise.all([
    populateUser(User.find(filter).sort('name').skip(skip).limit(limit)),
    User.countDocuments(filter)
  ]);
  return sendSuccess(res, { data: users, pagination: paginationMeta(page, limit, total) });
};

export const getUser = async (req, res) => {
  const user = await populateUser(User.findOne({ _id: req.params.id, ...(await getUserScope(req.user)) }));
  if (!user) throw new ApiError(404, 'User not found');
  return sendSuccess(res, { data: user });
};

export const createUser = async (req, res) => {
  assertRoleAllowed(req.user, req.body.role);
  await assertManagerExists(req.body.reportingManager);
  const email = req.body.email.trim().toLowerCase();
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists');
  const user = await User.create({ ...req.body, email, createdBy: req.user._id });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'User created successfully',
    data: await populateUser(User.findById(user._id))
  });
};

export const updateUser = async (req, res) => {
  const user = await User.findById(req.params.id).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!isAdmin(req.user) && String(user._id) !== String(req.user._id)) {
    throw new ApiError(403, 'You can only update your own profile');
  }
  if (user.role === 'superadmin' && !isSuperAdmin(req.user)) {
    throw new ApiError(403, 'Only a Super Admin can update a Super Admin');
  }
  if (String(req.user._id) === String(user._id) && req.body.isActive === false) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }
  if (String(req.user._id) === String(user._id) && req.body.role && req.body.role !== user.role) {
    throw new ApiError(400, 'You cannot change your own role');
  }
  assertRoleAllowed(req.user, req.body.role);
  await assertManagerExists(req.body.reportingManager);
  for (const field of editableFields) {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  }
  user.updatedBy = req.user._id;
  await user.save();
  return sendSuccess(res, {
    message: 'User updated successfully',
    data: await populateUser(User.findById(user._id))
  });
};

export const deleteUser = async (req, res) => {
  if (String(req.user._id) === String(req.params.id)) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role === 'superadmin' && !isSuperAdmin(req.user)) {
    throw new ApiError(403, 'Only a Super Admin can deactivate a Super Admin');
  }
  user.isActive = false;
  user.updatedBy = req.user._id;
  await user.save({ validateBeforeSave: false });
  return sendSuccess(res, { message: 'User deactivated successfully' });
};
