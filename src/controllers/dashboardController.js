import Lead from '../models/Lead.js';
import { buildAssignmentFilter } from '../utils/accessControl.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';

const TERMINAL_STATUSES = new Set(['Booking Done', 'Closure', 'Not Interested', 'Lost']);

const normalizeDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getFollowUpValue = (lead) => lead.followUpDate || lead.nextFollowUp || null;

export const stats = async (req, res) => {
  const leadFilter = await buildAssignmentFilter(req.user);

  const [
    totalLeads,
    callingCount,
    faceToFaceCount,
    siteVisitCount,
    followUpNeededCount,
    closureCount,
    notInterestedCount,
    newLeadsCount,
    pendingLeadsCount
  ] = await Promise.all([
    Lead.countDocuments(leadFilter),
    Lead.countDocuments({ ...leadFilter, status: 'Calling', isArchived: false }),
    Lead.countDocuments({ ...leadFilter, status: 'Face to Face', isArchived: false }),
    Lead.countDocuments({ ...leadFilter, status: 'Site Visit', isArchived: false }),
    Lead.countDocuments({ ...leadFilter, status: 'Follow-up Needed', isArchived: false }),
    Lead.countDocuments({ ...leadFilter, status: 'Closure', isArchived: false }),
    Lead.countDocuments({ ...leadFilter, status: 'Not Interested', isArchived: false }),
    Lead.countDocuments({ ...leadFilter, status: 'New', isArchived: false }),
    Lead.countDocuments({
      ...leadFilter,
      status: { $nin: [...TERMINAL_STATUSES] },
      isArchived: false
    })
  ]);

  return sendSuccess(res, {
    data: {
      totalLeads,
      callingCount,
      faceToFaceCount,
      siteVisitCount,
      followUpNeededCount,
      closureCount,
      notInterestedCount,
      newLeadsCount,
      pendingLeadsCount
    }
  });
};

export const calendar = async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date();
  const to = req.query.to ? new Date(req.query.to) : new Date(from.getTime() + 30 * 86400000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    throw new ApiError(400, 'Provide a valid calendar date range');
  }

  const leadFilter = await buildAssignmentFilter(req.user);

  const leads = await Lead.find({
    ...leadFilter,
    isArchived: false,
    status: { $nin: [...TERMINAL_STATUSES] },
    $or: [
      { followUpDate: { $gte: from, $lte: to } },
      { followUpDate: null, nextFollowUp: { $gte: from, $lte: to } }
    ]
  })
    .populate('assignedTo', 'name role')
    .populate('project', 'name code')
    .select('name status assignedTo followUpDate nextFollowUp project')
    .sort({ followUpDate: 1, nextFollowUp: 1, createdAt: 1 })
    .lean();

  const grouped = new Map();

  for (const lead of leads) {
    const followUpDate = getFollowUpValue(lead);
    const dateKey = normalizeDateKey(followUpDate);
    if (!dateKey) continue;

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }

    grouped.get(dateKey).push({
      leadId: lead._id,
      customerName: lead.name,
      status: lead.status,
      assignedTo: lead.assignedTo
        ? {
            id: lead.assignedTo._id,
            name: lead.assignedTo.name,
            role: lead.assignedTo.role
          }
        : null,
      followUpDate,
      interestedProject: lead.project
        ? {
            id: lead.project._id,
            name: lead.project.name,
            code: lead.project.code
          }
        : null
    });
  }

  const data = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([followUpDate, items]) => ({ followUpDate, items }));

  return sendSuccess(res, { data });
};
