import { createReadStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import Booking from '../models/Booking.js';
import FileRecord, { FILE_CATEGORIES } from '../models/File.js';
import Lead from '../models/Lead.js';
import SiteVisit from '../models/SiteVisit.js';
import { uploadDirectory } from '../middleware/uploadMiddleware.js';
import { recordActivity } from '../services/activityService.js';
import { buildAssignmentFilter } from '../utils/accessControl.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const populateFile = query => query
  .populate('lead', 'name phone status')
  .populate('project', 'name code')
  .populate('propertyUnit', 'unitNumber tower type')
  .populate('siteVisit', 'scheduledAt status')
  .populate('booking', 'bookingNumber status')
  .populate('uploadedBy deletedBy', 'name email role');

const getAccessibleLeadIds = async user => Lead.find(await buildAssignmentFilter(user)).distinct('_id');

const assertFileAccess = async (file, user) => {
  let leadId = file.lead?._id || file.lead;
  if (!leadId && file.booking) {
    const booking = await Booking.findById(file.booking).select('lead');
    leadId = booking?.lead;
  }
  if (!leadId && file.siteVisit) {
    const visit = await SiteVisit.findById(file.siteVisit).select('lead');
    leadId = visit?.lead;
  }
  if (leadId) {
    const lead = await Lead.findOne({ _id: leadId, ...(await buildAssignmentFilter(user)) });
    if (!lead) throw new ApiError(404, 'Accessible file not found');
  }
};

const getAccessibleFile = async (id, user, includePath = false) => {
  const query = FileRecord.findOne({ _id: id, isDeleted: false });
  if (includePath) query.select('+path');
  const file = await query;
  if (!file) throw new ApiError(404, 'File not found');
  await assertFileAccess(file, user);
  return file;
};

export const getFiles = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const leadIds = await getAccessibleLeadIds(req.user);
  const [bookingIds, visitIds] = await Promise.all([
    Booking.find({ lead: { $in: leadIds } }).distinct('_id'),
    SiteVisit.find({ lead: { $in: leadIds } }).distinct('_id')
  ]);
  const filter = {
    isDeleted: false,
    $or: [
      { lead: { $in: leadIds } },
      { booking: { $in: bookingIds } },
      { siteVisit: { $in: visitIds } },
      { project: { $exists: true }, lead: { $exists: false }, booking: { $exists: false } },
      { propertyUnit: { $exists: true }, lead: { $exists: false }, booking: { $exists: false } }
    ]
  };
  for (const field of ['lead', 'project', 'propertyUnit', 'siteVisit', 'booking', 'category', 'uploadedBy']) {
    if (req.query[field]) filter[field] = req.query[field];
  }
  const [files, total] = await Promise.all([
    populateFile(FileRecord.find(filter).sort('-createdAt').skip(skip).limit(limit)),
    FileRecord.countDocuments(filter)
  ]);
  return sendSuccess(res, { data: files, pagination: paginationMeta(page, limit, total) });
};

export const uploadFileRecord = async (req, res) => {
  if (!req.file) throw new ApiError(400, 'File is required');
  const references = {
    lead: req.body.lead || req.body.leadId,
    project: req.body.project || req.body.projectId,
    propertyUnit: req.body.propertyUnit || req.body.propertyUnitId,
    siteVisit: req.body.siteVisit || req.body.siteVisitId,
    booking: req.body.booking || req.body.bookingId
  };
  if (!Object.values(references).some(Boolean)) {
    await unlink(req.file.path).catch(() => undefined);
    throw new ApiError(422, 'Provide a lead, project, property unit, site visit, or booking reference');
  }
  const category = req.body.category || 'Other';
  if (!FILE_CATEGORIES.includes(category)) {
    await unlink(req.file.path).catch(() => undefined);
    throw new ApiError(422, 'Invalid file category');
  }
  const accessProbe = { ...references };
  try {
    await assertFileAccess(accessProbe, req.user);
  } catch (error) {
    await unlink(req.file.path).catch(() => undefined);
    throw error;
  }

  const record = new FileRecord({
    ...references,
    uploadedBy: req.user._id,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    extension: path.extname(req.file.originalname).slice(1),
    size: req.file.size,
    path: req.file.path,
    category,
    visibility: req.body.visibility || 'Private',
    description: req.body.description
  });
  record.url = `/api/files/${record._id}/download`;
  try {
    await record.save();
  } catch (error) {
    await unlink(req.file.path).catch(() => undefined);
    throw error;
  }
  await recordActivity({
    ...references,
    user: req.user._id,
    type: 'File Upload',
    description: `Uploaded ${record.originalName}`,
    metadata: { fileId: record._id, category: record.category, size: record.size }
  });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'File uploaded successfully',
    data: await populateFile(FileRecord.findById(record._id))
  });
};

export const uploadLeadFile = uploadFileRecord;

export const getFile = async (req, res) => sendSuccess(res, {
  data: await populateFile(FileRecord.findById((await getAccessibleFile(req.params.id, req.user))._id))
});

export const updateFile = async (req, res) => {
  const file = await getAccessibleFile(req.params.id, req.user);
  for (const field of ['category', 'visibility', 'description']) {
    if (req.body[field] !== undefined) file[field] = req.body[field];
  }
  await file.save();
  return sendSuccess(res, {
    message: 'File metadata updated successfully',
    data: await populateFile(FileRecord.findById(file._id))
  });
};

export const downloadFile = async (req, res, next) => {
  try {
    const file = await getAccessibleFile(req.params.id, req.user, true);
    const resolvedPath = path.resolve(file.path);
    const root = `${path.resolve(uploadDirectory)}${path.sep}`;
    if (!resolvedPath.startsWith(root)) throw new ApiError(400, 'Stored file path is invalid');
    try {
      await stat(resolvedPath);
    } catch (error) {
      if (error.code === 'ENOENT') throw new ApiError(404, 'Stored file is missing');
      throw error;
    }
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    const stream = createReadStream(resolvedPath);
    stream.on('error', next);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const deleteFile = async (req, res) => {
  const file = await getAccessibleFile(req.params.id, req.user);
  file.isDeleted = true;
  file.deletedAt = new Date();
  file.deletedBy = req.user._id;
  await file.save();
  await recordActivity({
    lead: file.lead, project: file.project, propertyUnit: file.propertyUnit,
    siteVisit: file.siteVisit, booking: file.booking, user: req.user._id,
    type: 'File Deleted', description: `Deleted ${file.originalName}`,
    metadata: { category: file.category }
  });
  return sendSuccess(res, { message: 'File deleted successfully' });
};
