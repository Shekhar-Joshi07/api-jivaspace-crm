export const CRM_ROLES = [
  'superadmin',
  'admin',
  'sales_executive'
];

export const ADMIN_ROLES = ['superadmin', 'admin'];
export const SUPERADMIN_ROLES = ['superadmin'];
export const MANAGEMENT_ROLES = ADMIN_ROLES;

export const isSuperAdmin = user => user?.role === 'superadmin';
export const isAdmin = user => ADMIN_ROLES.includes(user?.role);
export const isSalesExecutive = user => user?.role === 'sales_executive';
export const isBusinessExecutive = isSalesExecutive;
export const canManageTeam = user => isAdmin(user) || isSuperAdmin(user);

export const getManagedUserIds = async (user) => {
  if (isSuperAdmin(user) || isAdmin(user)) return null;
  return [String(user._id)];
};

export const buildAssignmentFilter = async (user, field = 'assignedTo') => {
  const userIds = await getManagedUserIds(user);
  return userIds ? { [field]: { $in: userIds } } : {};
};

export const canAccessAssignedRecord = async (user, assignedTo) => {
  if (isAdmin(user) || isSuperAdmin(user)) return true;
  const userIds = await getManagedUserIds(user);
  return userIds.some(id => String(id) === String(assignedTo));
};
