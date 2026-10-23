import Lead from '../models/Lead.js';
import SiteVisit from '../models/SiteVisit.js';
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

const calendarDateRange = (fromValue, toValue) => {
  const from = fromValue ? new Date(fromValue) : new Date();
  const to = toValue ? new Date(toValue) : new Date(from.getTime() + 30 * 86400000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    throw new ApiError(400, 'Provide a valid calendar date range');
  }

  // Calendar controls send date-only values. Include the whole final day so
  // visits that carry a time component are not excluded from their date cell.
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
};

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
  const { from, to } = calendarDateRange(req.query.from, req.query.to);

  const leadFilter = await buildAssignmentFilter(req.user);

  const [leads, accessibleLeadIds] = await Promise.all([
    Lead.find({
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
    .lean(),
    Lead.find(leadFilter).distinct('_id')
  ]);

  const siteVisits = await SiteVisit.find({
    lead: { $in: accessibleLeadIds },
    isActive: { $ne: false },
    $or: [
      {
        $and: [
          { $or: [{ visitStatus: { $in: ['Scheduled', 'Rescheduled'] } }, { visitStatus: null, status: { $in: ['Scheduled', 'Rescheduled'] } }] },
          { $or: [{ visitDate: { $gte: from, $lte: to } }, { visitDate: null, scheduledAt: { $gte: from, $lte: to } }] }
        ]
      },
      { nextFollowUpDate: { $gte: from, $lte: to } },
      { nextFollowUpDate: null, nextFollowUpAt: { $gte: from, $lte: to } }
    ]
  })
    .populate('lead', 'name')
    .populate('assignedSalesPerson', 'name role')
    .populate('project', 'name code')
    .select('lead project visitDate scheduledAt visitStatus status nextFollowUpDate nextFollowUpAt assignedSalesPerson')
    .sort({ visitDate: 1, scheduledAt: 1, nextFollowUpDate: 1, nextFollowUpAt: 1, createdAt: 1 })
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
      id: `lead-follow-up-${lead._id}`,
      leadId: lead._id,
      customerName: lead.name,
      status: lead.status,
      eventType: 'Lead follow-up',
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

  for (const visit of siteVisits) {
    const visitDate = visit.visitDate || visit.scheduledAt;
    const followUpDate = visit.nextFollowUpDate || visit.nextFollowUpAt;
    const visitStatus = visit.visitStatus || visit.status || 'Scheduled';
    const shared = {
      leadId: visit.lead?._id || visit.lead,
      customerName: visit.lead?.name || 'Site visit',
      assignedTo: visit.assignedSalesPerson
        ? {
            id: visit.assignedSalesPerson._id,
            name: visit.assignedSalesPerson.name,
            role: visit.assignedSalesPerson.role
          }
        : null,
      interestedProject: visit.project
        ? {
            id: visit.project._id,
            name: visit.project.name,
            code: visit.project.code
          }
        : null
    };

    const addVisitEvent = (date, id, status, eventType) => {
      const dateKey = normalizeDateKey(date);
      if (!dateKey) return;
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey).push({
        ...shared,
        id,
        followUpDate: date,
        status,
        eventType,
        siteVisitId: visit._id
      });
    };

    if (visitDate >= from && visitDate <= to) {
      addVisitEvent(visitDate, `site-visit-${visit._id}`, visitStatus, 'Site visit');
    }
    if (followUpDate >= from && followUpDate <= to) {
      addVisitEvent(followUpDate, `site-follow-up-${visit._id}`, 'Follow-up Needed', 'Site visit follow-up');
    }
  }

  const data = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([followUpDate, items]) => ({ followUpDate, items }));

  return sendSuccess(res, { data });
};
