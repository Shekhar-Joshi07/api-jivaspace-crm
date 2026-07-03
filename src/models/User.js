import bcrypt from 'bcryptjs';
import mongoose from '../config/mongoose.js';

export const USER_ROLES = [
  'superadmin',
  'admin',
  'sales_executive'
];

const LEGACY_ROLE_MAP = {
  'Super Admin': 'superadmin',
  'Admin': 'admin',
  'Sales Executive': 'sales_executive',
  'Telecaller': 'sales_executive',
  'Manager': 'admin',
  'Team Leader': 'admin',
  business_executive: 'sales_executive',
  support_staff: 'sales_executive',
  agent: 'sales_executive',
  manager: 'admin',
  team_leader: 'admin',
  telecaller: 'sales_executive'
};

export const normalizeUserRole = role => LEGACY_ROLE_MAP[role] || role;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    employeeId: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
      maxlength: [30, 'Employee ID cannot exceed 30 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address']
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone cannot exceed 20 characters']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      maxlength: [128, 'Password cannot exceed 128 characters'],
      select: false
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'sales_executive',
      set: normalizeUserRole,
      index: true
    },
    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    avatarUrl: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: Date,
    passwordChangedAt: Date,
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpiresAt: { type: Date, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpiresAt;
        return ret;
      }
    }
  }
);

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ reportingManager: 1, isActive: 1 });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date();
});

userSchema.methods.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model('User', userSchema);
