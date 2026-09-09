import mongoose from '../config/mongoose.js';

const attendanceConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'primary', unique: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    radiusMeters: { type: Number, required: true, min: 25, max: 10000, default: 200 },
    isEnabled: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default mongoose.model('AttendanceConfig', attendanceConfigSchema);
