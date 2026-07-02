import { body, param, query } from 'express-validator';
import { ACTIVITY_TYPES } from '../models/Activity.js';
import { LEAD_SOURCES, LEAD_STATUSES } from '../models/Lead.js';
import { AVAILABILITY_STATUSES, PROPERTY_UNIT_BHK } from '../models/PropertyUnit.js';
import { PROJECT_PROPERTY_TYPES, PROJECT_STATUSES } from '../models/Project.js';
import { TASK_STATUSES } from '../models/Task.js';
import { USER_ROLES } from '../models/User.js';

const passwordRule = field => body(field)
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be between 8 and 128 characters')
  .matches(/[A-Za-z]/)
  .withMessage('Password must contain a letter')
  .matches(/\d/)
  .withMessage('Password must contain a number');

export const idParam = (name = 'id') => param(name).isMongoId().withMessage(`Invalid ${name}`);

export const registerRules = [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('email').trim().isEmail().normalizeEmail(),
  passwordRule('password'),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 30 })
];

export const loginRules = [
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isString().notEmpty()
];

export const forgotPasswordRules = [body('email').trim().isEmail().normalizeEmail()];
export const resetPasswordRules = [passwordRule('password')];
export const changePasswordRules = [
  body('currentPassword').isString().notEmpty(),
  passwordRule('newPassword')
];

export const createUserRules = [
  ...registerRules,
  body('role').isIn(USER_ROLES).withMessage(`Role must be one of: ${USER_ROLES.join(', ')}`)
];

export const updateUserRules = [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('role').optional().isIn(USER_ROLES),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 30 }),
  body('avatarUrl').optional({ nullable: true }).isURL(),
  body('isActive').optional().isBoolean()
];

const leadFieldRules = [
  body('customerName').optional().trim().notEmpty().isLength({ max: 150 }),
  body('name').optional().trim().notEmpty().isLength({ max: 150 }),
  body('mobile').optional().trim().notEmpty().isLength({ max: 20 }),
  body('phone').optional().trim().notEmpty().isLength({ max: 20 }),
  body('alternateMobile').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('alternatePhone').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('email').optional({ checkFalsy: true }).trim().isEmail().normalizeEmail(),
  body('leadSource').optional().isIn(LEAD_SOURCES),
  body('source').optional().isIn(LEAD_SOURCES),
  body('status').optional().isIn(LEAD_STATUSES),
  body('priority').optional().isIn(['Low', 'Medium', 'High', 'Hot']),
  body('assignedTo').optional({ checkFalsy: true }).isMongoId(),
  body('followUpDate').optional({ checkFalsy: true }).isISO8601(),
  body('nextFollowUp').optional({ checkFalsy: true }).isISO8601(),
  body('budget').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
  body('locationPreference').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('preferredLocation').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('interestedProject').optional({ checkFalsy: true }).isMongoId(),
  body('project').optional({ checkFalsy: true }).isMongoId(),
  body('interestedPropertyType').optional({ nullable: true }).isString().isLength({ max: 100 }),
  body('propertyType').optional({ nullable: true }).isString().isLength({ max: 100 }),
  body('remarks').optional({ nullable: true }).isLength({ max: 5000 }),
  body('estimatedValue').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
  body('revenue').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
  body('interestedProperty').optional({ checkFalsy: true }).isMongoId()
];

export const createLeadRules = [
  body('customerName').optional().trim().isLength({ max: 150 }),
  body('name').optional().trim().isLength({ max: 150 }),
  body('mobile').optional().trim().isLength({ max: 20 }),
  body('phone').optional().trim().isLength({ max: 20 }),
  body().custom((_, { req }) => {
    if (!(req.body.customerName || req.body.name)) {
      throw new Error('customerName is required');
    }
    if (!(req.body.mobile || req.body.phone)) {
      throw new Error('mobile is required');
    }
    return true;
  }),
  body('email').optional({ checkFalsy: true }).trim().isEmail().normalizeEmail(),
  ...leadFieldRules.slice(4)
];
export const updateLeadRules = leadFieldRules;
export const updateLeadStatusRules = [
  body('status').isIn(LEAD_STATUSES),
  body('remarks').optional({ nullable: true }).isLength({ max: 5000 }),
  body('followUpDate').optional({ checkFalsy: true }).isISO8601(),
  body('nextFollowUp').optional({ checkFalsy: true }).isISO8601()
];
export const leadRemarkRules = [body('remarks').trim().notEmpty().isLength({ max: 5000 })];
export const leadTimelineRules = [
  body('type').isIn(ACTIVITY_TYPES),
  body('description').trim().notEmpty().isLength({ max: 3000 }),
  body('channel').optional().isIn(['Call', 'Email', 'SMS', 'WhatsApp', 'In Person', 'System']),
  body('direction').optional().isIn(['Inbound', 'Outbound', 'Internal']),
  body('outcome').optional().isLength({ max: 500 }),
  body('durationSeconds').optional().isInt({ min: 0 })
];
export const duplicateMobileRules = [query('mobile').trim().notEmpty().isLength({ max: 20 })];
export const noteRules = leadRemarkRules;
export const assignLeadRules = [body('assignedTo').isMongoId()];
export const transferLeadRules = [
  body('leadId').isMongoId(),
  body('toUser').isMongoId(),
  body('reason').trim().notEmpty().isLength({ max: 1000 })
];

const taskFieldRules = [
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional({ nullable: true }).trim().isLength({ max: 5000 }),
  body('assignedTo').optional({ checkFalsy: true }).isMongoId(),
  body('relatedLead').optional({ checkFalsy: true }).isMongoId(),
  body('lead').optional({ checkFalsy: true }).isMongoId(),
  body('dueDate').optional().isISO8601(),
  body('reminderAt').optional({ checkFalsy: true }).isISO8601(),
  body('priority').optional().isIn(['Low', 'Medium', 'High', 'Urgent']),
  body('status').optional().isIn(TASK_STATUSES)
];
export const createTaskRules = [
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('dueDate').isISO8601(),
  ...taskFieldRules.slice(1, 5),
  ...taskFieldRules.slice(6)
];
export const updateTaskRules = taskFieldRules;

export const createActivityRules = [
  body('lead').optional({ checkFalsy: true }).isMongoId(),
  body('task').optional({ checkFalsy: true }).isMongoId(),
  body('type').isIn(ACTIVITY_TYPES),
  body('description').trim().notEmpty().isLength({ max: 3000 }),
  body('metadata').optional().isObject()
];
export const updateActivityRules = [
  body('description').optional().trim().notEmpty().isLength({ max: 3000 }),
  body('metadata').optional().isObject()
];

export const emailRules = [
  body('to').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('subject').trim().notEmpty().isLength({ max: 300 }),
  body('message').trim().notEmpty().isLength({ max: 10000 }),
  body('html').optional().isString()
];
export const smsRules = [
  body('to').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('message').trim().notEmpty().isLength({ max: 1600 })
];

export const reportQueryRules = [
  query('from').optional().isISO8601().withMessage('from must be a valid date'),
  query('to').optional().isISO8601().withMessage('to must be a valid date')
];

export const createNotificationRules = [
  body('user').isMongoId(),
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('message').trim().notEmpty().isLength({ max: 1000 }),
  body('type').optional().isIn([
    'task_assigned',
    'lead_assigned',
    'lead_transferred',
    'follow_up',
    'task_due',
    'task_overdue',
    'site_visit',
    'booking',
    'payment',
    'status_changed',
    'general'
  ]),
  body('relatedLead').optional({ checkFalsy: true }).isMongoId(),
  body('relatedTask').optional({ checkFalsy: true }).isMongoId()
];

export const updateFileRules = [
  body('category').optional().isIn([
    'Lead Document',
    'Project Brochure',
    'Floor Plan',
    'KYC',
    'Booking Form',
    'Payment Receipt',
    'Agreement',
    'Image',
    'Other'
  ]),
  body('visibility').optional().isIn(['Private', 'Internal', 'Public']),
  body('description').optional({ nullable: true }).trim().isLength({ max: 1000 })
];

const projectFieldRules = [
  body('projectName').optional().trim().notEmpty().isLength({ max: 200 }),
  body('builderName').optional().trim().notEmpty().isLength({ max: 200 }),
  body('location').optional().trim().notEmpty().isLength({ max: 300 }),
  body('propertyType').optional().isIn(PROJECT_PROPERTY_TYPES),
  body('priceRange').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('totalUnits').optional({ nullable: true }).isInt({ min: 0 }).toInt(),
  body('availableUnits').optional({ nullable: true }).isInt({ min: 0 }).toInt(),
  body('status').optional().isIn(PROJECT_STATUSES),
  body('amenities').optional().isArray(),
  body('description').optional({ nullable: true }).isLength({ max: 10000 }),
  body('brochure').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  body('images').optional().isArray()
];

export const createProjectRules = [
  body('projectName').trim().notEmpty().isLength({ max: 200 }),
  body('builderName').trim().notEmpty().isLength({ max: 200 }),
  body('location').trim().notEmpty().isLength({ max: 300 }),
  body('propertyType').isIn(PROJECT_PROPERTY_TYPES),
  ...projectFieldRules.slice(4)
];
export const updateProjectRules = projectFieldRules;

const propertyUnitFieldRules = [
  body('project').optional({ checkFalsy: true }).isMongoId(),
  body('unitNumber').optional().trim().notEmpty().isLength({ max: 50 }),
  body('towerBlock').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('floor').optional({ nullable: true }).isInt({ min: 0 }).toInt(),
  body('bhk').optional().isIn(PROPERTY_UNIT_BHK),
  body('areaSqft').optional({ nullable: true }).isFloat({ min: 0 }).toFloat(),
  body('facing').optional().isIn(['North', 'South', 'East', 'West', 'North East', 'North West', 'South East', 'South West']),
  body('price').optional({ nullable: true }).isFloat({ min: 0 }).toFloat(),
  body('availabilityStatus').optional().isIn(AVAILABILITY_STATUSES),
  body('description').optional({ nullable: true }).isLength({ max: 3000 })
];

export const createPropertyUnitRules = [
  body('project').isMongoId(),
  body('unitNumber').trim().notEmpty().isLength({ max: 50 }),
  body('price').isFloat({ min: 0 }).toFloat(),
  ...propertyUnitFieldRules.slice(2)
];
export const updatePropertyUnitRules = propertyUnitFieldRules;

const siteVisitFieldRules = [
  body('lead').optional({ checkFalsy: true }).isMongoId(),
  body('project').optional({ checkFalsy: true }).isMongoId(),
  body('visitDate').optional().isISO8601(),
  body('visitTime').optional({ nullable: true }).isString().isLength({ max: 20 }),
  body('assignedSalesPerson').optional({ checkFalsy: true }).isMongoId(),
  body('visitStatus').optional().isIn(['Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No Show']),
  body('customerFeedback').optional({ nullable: true }).isLength({ max: 3000 }),
  body('nextFollowUpDate').optional({ checkFalsy: true }).isISO8601()
];

export const createSiteVisitRules = [
  body('lead').isMongoId(),
  body('project').isMongoId(),
  body('visitDate').isISO8601(),
  ...siteVisitFieldRules.slice(3)
];
export const updateSiteVisitRules = siteVisitFieldRules;

const bookingFieldRules = [
  body('lead').optional({ checkFalsy: true }).isMongoId(),
  body('project').optional({ checkFalsy: true }).isMongoId(),
  body('propertyUnit').optional({ checkFalsy: true }).isMongoId(),
  body('bookingAmount').optional({ nullable: true }).isFloat({ min: 0 }).toFloat(),
  body('bookingDate').optional().isISO8601(),
  body('paymentMode').optional().isIn(['Cash', 'Cheque', 'Bank Transfer', 'UPI', 'Card', 'Other']),
  body('bookingStatus').optional().isIn(['Pending', 'Confirmed', 'Cancelled', 'Converted to Sale']),
  body('documents').optional().isArray(),
  body('remarks').optional({ nullable: true }).isLength({ max: 3000 })
];

export const createBookingRules = [
  body('lead').isMongoId(),
  body('project').isMongoId(),
  body('propertyUnit').isMongoId(),
  body('bookingAmount').isFloat({ min: 0 }).toFloat(),
  ...bookingFieldRules.slice(4)
];
export const updateBookingRules = bookingFieldRules;
