export const PROPERTY_TYPES = [
  'Residential',
  'Commercial',
  'Plots',
  'Villas',
  'Apartment',
  'Villa',
  'Plot',
  'Builder Floor',
  'Office',
  'Shop',
  'Warehouse',
  'Other'
];

export const normalizePropertyType = value => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return PROPERTY_TYPES.find(type => type.toLowerCase() === trimmed.toLowerCase()) || trimmed;
};
