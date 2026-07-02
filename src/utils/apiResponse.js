export const sendSuccess = (res, options = {}) => {
  const {
    statusCode = 200,
    message,
    data,
    pagination,
    meta
  } = options;

  const payload = { success: true };
  if (message) payload.message = message;
  if (data !== undefined) payload.data = data;
  if (pagination) payload.pagination = pagination;
  if (meta) payload.meta = meta;

  return res.status(statusCode).json(payload);
};

export const getPagination = (query, defaults = {}) => {
  const defaultLimit = defaults.defaultLimit || 20;
  const maxLimit = defaults.maxLimit || 100;
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);

  return { page, limit, skip: (page - 1) * limit };
};

export const paginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.max(Math.ceil(total / limit), 1),
  hasNextPage: page * limit < total,
  hasPreviousPage: page > 1
});
