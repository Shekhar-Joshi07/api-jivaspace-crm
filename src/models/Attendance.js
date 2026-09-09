import mongoose from '../config/mongoose.js';

const locationSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracyMeters: { type: Number, min: 0 },
    distanceMeters: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    checkIn: { type: locationSchema, required: true },
    checkOut: locationSchema,
    office: {
      name: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      radiusMeters: { type: Number, required: true }
    }
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, dateKey: 1 }, { unique: true });
attendanceSchema.index({ dateKey: -1, user: 1 });

export default mongoose.model('Attendance', attendanceSchema);
