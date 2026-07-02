import Booking from '../models/Booking.js';
import Lead from '../models/Lead.js';
import Project from '../models/Project.js';
import PropertyUnit from '../models/PropertyUnit.js';
import { recordActivity } from '../services/activityService.js';
import { createNotification } from '../services/notificationService.js';
import { buildAssignmentFilter, canAccessAssignedRecord } from '../utils/accessControl.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pick = body => {
  const payload = {};
  const fields = [
    'lead',
    'project',
    'propertyUnit',
    'bookingAmount',
    'bookingDate',
    'paymentMode',
    'bookingStatus',
    'documents',
    'remarks',
    'isActive',
    // legacy compatibility
    'bookingNumber',
    'siteVisit',
    'status',
    'salePrice',
    'tokenAmount',
    'discountAmount',
    'taxAmount',
    'netAmount',
    'paymentStatus',
    'payments',
    'paymentPlan',
    'jointApplicants',
    'notes',
    'cancellationReason'
  ];
  for (const field of fields) {
    if (body[field] !== undefined) payload[field] = body[field];
  }
  return payload;
};

const normalizePayload = body => {
  const payload = pick(body);
  if (!payload.bookingStatus && body.status) payload.bookingStatus = body.status;
  if (!payload.status && payload.bookingStatus) payload.status = payload.bookingStatus;
  if (!payload.remarks && body.notes) payload.remarks = body.notes;
  if (!payload.salePrice && payload.bookingAmount != null) payload.salePrice = payload.bookingAmount;
  if (!payload.tokenAmount && payload.bookingAmount != null) payload.tokenAmount = payload.bookingAmount;
  if (!payload.netAmount && payload.bookingAmount != null) payload.netAmount = payload.bookingAmount;
  if (payload.documents && !Array.isArray(payload.documents)) payload.documents = [payload.documents].flat();
  return payload;
};

const populateBooking = query => query
  .populate('lead', 'customerName name mobile phone status assignedTo')
  .populate('project', 'projectName name builderName location status')
  .populate('propertyUnit', 'unitNumber towerBlock tower floor bhk price availabilityStatus')
  .populate('siteVisit', 'visitDate visitTime visitStatus')
  .populate('documents', 'originalName category url')
  .populate('createdBy updatedBy bookedBy cancelledBy', 'name email role employeeId');

const formatBooking = booking => {
  const obj = typeof booking?.toObject === 'function' ? booking.toObject() : booking;
  return {
    id: obj._id,
    lead: obj.lead,
    project: obj.project,
    propertyUnit: obj.propertyUnit,
    bookingAmount: obj.bookingAmount ?? obj.tokenAmount ?? obj.salePrice ?? null,
    bookingDate: obj.bookingDate || null,
    paymentMode: obj.paymentMode || null,
    bookingStatus: obj.bookingStatus || obj.status,
    documents: obj.documents || [],
    remarks: obj.remarks || obj.notes || null,
    isActive: !!obj.isActive,
    createdBy: obj.createdBy || null,
    updatedBy: obj.updatedBy || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

const getAccessibleBooking = async (id, user) => {
  const leadIds = await Lead.find(await buildAssignmentFilter(user)).distinct('_id');
  const booking = await populateBooking(Booking.findOne({ _id: id, lead: { $in: leadIds } }));
  if (!booking) throw new ApiError(404, 'Booking not found');
  return booking;
};

const assertBookingReferences = async (payload, user, currentBookingId) => {
  const [lead, project, unit] = await Promise.all([
    Lead.findById(payload.lead),
    Project.findById(payload.project),
    PropertyUnit.findById(payload.propertyUnit)
  ]);

  if (!lead || !(await canAccessAssignedRecord(user, lead.assignedTo))) {
    throw new ApiError(404, 'Accessible lead not found');
  }
  if (!project?.isActive) throw new ApiError(422, 'Active project not found');
  if (!unit || String(unit.project) !== String(project._id)) {
    throw new ApiError(422, 'Property unit does not belong to the selected project');
  }

  if (
    unit.availabilityStatus !== 'Available'
    && String(unit.currentBooking || '') !== String(currentBookingId || '')
  ) {
    throw new ApiError(409, 'Property unit is not available for booking');
  }

  return { lead, unit };
};

const updateUnitBookingState = async (unitId, status, bookingId, userId) => {
  if (status === 'Converted to Sale') {
    await PropertyUnit.updateOne(
      { _id: unitId },
      {
        $set: {
          availabilityStatus: 'Sold',
          status: 'Sold',
          currentBooking: bookingId,
          updatedBy: userId
        }
      }
    );
    return;
  }

  if (status === 'Confirmed') {
    await PropertyUnit.updateOne(
      { _id: unitId },
      {
        $set: {
          availabilityStatus: 'Booked',
          status: 'Booked',
          currentBooking: bookingId,
          updatedBy: userId
        }
      }
    );
    return;
  }

  if (status === 'Cancelled') {
    await PropertyUnit.updateOne(
      { _id: unitId, currentBooking: bookingId },
      {
        $set: {
          availabilityStatus: 'Available',
          status: 'Available',
          updatedBy: userId
        },
      $unset: { currentBooking: 1 }
    }
  );
    return;
  }

  await PropertyUnit.updateOne(
    { _id: unitId },
    {
      $set: {
        availabilityStatus: 'Hold',
        status: 'Hold',
        currentBooking: bookingId,
        updatedBy: userId
      }
    }
  );
};

export const getBookings = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const leadIds = await Lead.find(await buildAssignmentFilter(req.user)).distinct('_id');
  const filter = { lead: { $in: leadIds } };

  for (const field of ['lead', 'project', 'propertyUnit', 'bookingStatus', 'status', 'paymentMode']) {
    if (req.query[field]) {
      filter[field === 'status' ? 'bookingStatus' : field] = req.query[field];
    }
  }

  if (req.query.search) {
    const search = new RegExp(escapeRegExp(req.query.search), 'i');
    filter.$or = [{ bookingNumber: search }, { remarks: search }];
  }

  if (req.query.from || req.query.to) {
    filter.bookingDate = {};
    if (req.query.from) filter.bookingDate.$gte = new Date(req.query.from);
    if (req.query.to) filter.bookingDate.$lte = new Date(req.query.to);
  }

  const [bookings, total] = await Promise.all([
    populateBooking(Booking.find(filter).sort('-bookingDate').skip(skip).limit(limit)),
    Booking.countDocuments(filter)
  ]);

  return sendSuccess(res, { data: bookings.map(formatBooking), pagination: paginationMeta(page, limit, total) });
};

export const getBooking = async (req, res) => sendSuccess(res, {
  data: formatBooking(await getAccessibleBooking(req.params.id, req.user))
});

export const createBooking = async (req, res) => {
  const payload = normalizePayload(req.body);
  const { lead, unit } = await assertBookingReferences(payload, req.user);

  const booking = await Booking.create({
    ...payload,
    bookedBy: req.user._id,
    createdBy: req.user._id,
    status: payload.bookingStatus || 'Pending'
  });

  await lead.updateOne({
    $set: {
      status: 'Booking Done',
      updatedBy: req.user._id
    }
  });

  await updateUnitBookingState(unit._id, booking.bookingStatus, booking._id, req.user._id);

  await Promise.all([
    recordActivity({
      lead: lead._id,
      project: booking.project,
      propertyUnit: booking.propertyUnit,
      booking: booking._id,
      user: req.user._id,
      type: 'Booking Created',
      description: `Booking created for ${lead.customerName || lead.name || 'lead'}`,
      metadata: {
        bookingAmount: booking.bookingAmount,
        bookingStatus: booking.bookingStatus
      }
    }),
    createNotification({
      user: lead.assignedTo,
      title: 'Booking created',
      message: `Booking created for ${lead.customerName || lead.name || 'lead'}`,
      type: 'booking',
      relatedLead: lead._id,
      relatedProject: booking.project,
      relatedPropertyUnit: booking.propertyUnit,
      relatedBooking: booking._id
    })
  ]);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Booking created successfully',
    data: formatBooking(await populateBooking(Booking.findById(booking._id)))
  });
};

export const updateBooking = async (req, res) => {
  const booking = await getAccessibleBooking(req.params.id, req.user);
  const payload = normalizePayload(req.body);

  await assertBookingReferences(
    {
      lead: payload.lead || booking.lead._id,
      project: payload.project || booking.project._id,
      propertyUnit: payload.propertyUnit || booking.propertyUnit._id
    },
    req.user,
    booking._id
  );

  const previousStatus = booking.bookingStatus;
  const previousUnitId = booking.propertyUnit._id;
  booking.set({ ...payload, updatedBy: req.user._id });
  await updateUnitBookingState(booking.propertyUnit._id, booking.bookingStatus, booking._id, req.user._id);

  if (booking.bookingStatus === 'Cancelled') {
    booking.cancelledAt ||= new Date();
    booking.cancelledBy = req.user._id;
  }

  await booking.save();

  if (previousStatus !== booking.bookingStatus) {
    await recordActivity({
      lead: booking.lead._id,
      project: booking.project._id,
      propertyUnit: booking.propertyUnit._id,
      booking: booking._id,
      user: req.user._id,
      type: 'Booking Updated',
      description: `Booking status changed from ${previousStatus} to ${booking.bookingStatus}`,
      metadata: { from: previousStatus, to: booking.bookingStatus }
    });
  }

  if (String(previousUnitId) !== String(booking.propertyUnit._id)) {
    await PropertyUnit.updateOne(
      { _id: previousUnitId, currentBooking: booking._id },
      {
        $set: { availabilityStatus: 'Available', status: 'Available', updatedBy: req.user._id },
        $unset: { currentBooking: 1 }
      }
    );
  }

  return sendSuccess(res, {
    message: 'Booking updated successfully',
    data: formatBooking(await populateBooking(Booking.findById(booking._id)))
  });
};

export const deleteBooking = async (req, res) => {
  const booking = await getAccessibleBooking(req.params.id, req.user);
  if (!['Cancelled', 'Converted to Sale'].includes(booking.bookingStatus)) {
    throw new ApiError(409, 'Only cancelled or converted bookings can be deleted');
  }

  await Promise.all([
    booking.deleteOne(),
    PropertyUnit.updateOne(
      { _id: booking.propertyUnit._id, currentBooking: booking._id },
      {
        $set: { availabilityStatus: 'Available', status: 'Available', updatedBy: req.user._id },
        $unset: { currentBooking: 1 }
      }
    )
  ]);

  return sendSuccess(res, { message: 'Booking deleted successfully' });
};
