import Attendance from '../models/Attendance.js';
import AttendanceConfig from '../models/AttendanceConfig.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const INDIA_TIME_ZONE = 'Asia/Kolkata';
const EARTH_RADIUS_METERS = 6371000;

const toRadians = degrees => degrees * (Math.PI / 180);

const distanceInMeters = (fromLatitude, fromLongitude, toLatitude, toLongitude) => {
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(fromLatitude)) * Math.cos(toRadians(toLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const dateKeyFor = date => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const valueFor = type => parts.find(part => part.type === type)?.value;
  return `${valueFor('year')}-${valueFor('month')}-${valueFor('day')}`;
};

const publicConfiguration = configuration => ({
  configured: Boolean(configuration),
  isEnabled: configuration?.isEnabled ?? false,
  name: configuration?.name || null,
  radiusMeters: configuration?.radiusMeters || null
});

const locationFromRequest = req => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const accuracyMeters = req.body.accuracyMeters === undefined ? undefined : Number(req.body.accuracyMeters);
  const address = typeof req.body.address === 'string' ? req.body.address.trim() : undefined;

  return {
    at: new Date(),
    latitude,
    longitude,
    address: address || undefined,
    accuracyMeters,
    distanceMeters: 0
  };
};

export const getTodayAttendance = async (req, res) => {
  const attendance = await Attendance.findOne({ user: req.user._id, dateKey: dateKeyFor(new Date()) });
  return sendSuccess(res, { data: { attendance } });
};

export const checkIn = async (req, res) => {
  const dateKey = dateKeyFor(new Date());
  const existing = await Attendance.findOne({ user: req.user._id, dateKey });
  if (existing) throw new ApiError(409, 'You have already checked in today');

  const attendance = await Attendance.create({
    user: req.user._id,
    dateKey,
    checkIn: locationFromRequest(req)
  });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Check-in recorded successfully',
    data: attendance
  });
};

export const checkOut = async (req, res) => {
  const attendance = await Attendance.findOne({ user: req.user._id, dateKey: dateKeyFor(new Date()) });
  if (!attendance) throw new ApiError(404, 'Check in before recording a check-out');
  if (attendance.checkOut) throw new ApiError(409, 'You have already checked out today');

  attendance.checkOut = locationFromRequest(req);
  await attendance.save();
  return sendSuccess(res, { message: 'Check-out recorded successfully', data: attendance });
};

export const getAttendanceConfiguration = async (req, res) => {
  const configuration = await AttendanceConfig.findOne({ key: 'primary' });
  const data = req.user.role === 'superadmin' ? configuration : publicConfiguration(configuration);
  return sendSuccess(res, { data });
};

export const updateAttendanceConfiguration = async (req, res) => {
  const configuration = await AttendanceConfig.findOneAndUpdate(
    { key: 'primary' },
    {
      $set: {
        name: req.body.name,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        radiusMeters: req.body.radiusMeters,
        isEnabled: req.body.isEnabled,
        updatedBy: req.user._id
      }
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return sendSuccess(res, { message: 'Attendance location settings saved', data: configuration });
};

export const getAttendanceAudit = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.user) filter.user = req.query.user;
  if (req.query.from || req.query.to) {
    filter.dateKey = {};
    if (req.query.from) filter.dateKey.$gte = req.query.from;
    if (req.query.to) filter.dateKey.$lte = req.query.to;
  }
  if (req.query.status === 'in-progress') filter.checkOut = { $exists: false };
  if (req.query.status === 'present') filter.checkOut = { $exists: true };

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .populate('user', 'name email employeeId role')
      .sort({ dateKey: -1, 'checkIn.at': -1 })
      .skip(skip)
      .limit(limit),
    Attendance.countDocuments(filter)
  ]);
  return sendSuccess(res, {
    data: records.map(record => ({
      ...record.toObject(),
      attendanceStatus: record.checkOut ? 'Present' : 'In progress'
    })),
    pagination: paginationMeta(page, limit, total)
  });
};
