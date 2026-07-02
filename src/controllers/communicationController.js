import Communication from '../models/Communication.js';
import Lead from '../models/Lead.js';
import { recordActivity } from '../services/activityService.js';
import { sendEmail } from '../services/emailService.js';
import { sendSMS } from '../services/smsService.js';
import { buildAssignmentFilter } from '../utils/accessControl.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, paginationMeta, sendSuccess } from '../utils/apiResponse.js';

const getAccessibleLead = async (leadId, user) => {
  const scope = await buildAssignmentFilter(user);
  const lead = await Lead.findOne({ _id: leadId, ...scope });
  if (!lead) throw new ApiError(404, 'Lead not found');
  return lead;
};

const storeCommunication = async ({
  lead,
  user,
  channel,
  recipient,
  subject,
  message,
  send
}) => {
  try {
    const result = await send();
    const log = await Communication.create({
      lead: lead._id,
      sentBy: user._id,
      channel,
      recipient,
      subject,
      message,
      status: 'Sent',
      providerMessageId: result.messageId
    });
    await recordActivity({
      lead: lead._id,
      user: user._id,
      type: channel,
      description: `${channel} sent to ${recipient}`,
      metadata: { communicationId: log._id, subject }
    });
    return log;
  } catch (error) {
    await Communication.create({
      lead: lead._id,
      sentBy: user._id,
      channel,
      recipient,
      subject,
      message,
      status: 'Failed',
      error: error.message
    });
    throw new ApiError(502, `${channel} could not be sent`);
  }
};

export const sendLeadEmail = async (req, res) => {
  const lead = await getAccessibleLead(req.params.leadId, req.user);
  const recipient = req.body.to || lead.email;
  if (!recipient) throw new ApiError(422, 'Lead does not have an email address');
  const log = await storeCommunication({
    lead,
    user: req.user,
    channel: 'Email',
    recipient,
    subject: req.body.subject,
    message: req.body.message,
    send: () => sendEmail({
      to: recipient,
      subject: req.body.subject,
      text: req.body.message,
      html: req.body.html
    })
  });
  return sendSuccess(res, { statusCode: 201, message: 'Email sent successfully', data: log });
};

export const sendLeadSMS = async (req, res) => {
  const lead = await getAccessibleLead(req.params.leadId, req.user);
  const recipient = req.body.to || lead.phone;
  if (!recipient) throw new ApiError(422, 'Lead does not have a phone number');
  const log = await storeCommunication({
    lead,
    user: req.user,
    channel: 'SMS',
    recipient,
    message: req.body.message,
    send: () => sendSMS({ to: recipient, message: req.body.message })
  });
  return sendSuccess(res, { statusCode: 201, message: 'SMS sent successfully', data: log });
};

export const getCommunicationLogs = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const leadScope = await buildAssignmentFilter(req.user);
  const leadIds = await Lead.find(leadScope).distinct('_id');
  const filter = { lead: { $in: leadIds } };
  if (req.query.lead) {
    filter.lead = leadIds.some(id => String(id) === String(req.query.lead))
      ? req.query.lead
      : { $in: [] };
  }
  if (req.query.channel) filter.channel = req.query.channel;

  const [logs, total] = await Promise.all([
    Communication.find(filter)
      .populate('lead', 'name email phone')
      .populate('sentBy', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Communication.countDocuments(filter)
  ]);
  return sendSuccess(res, {
    data: logs,
    pagination: paginationMeta(page, limit, total)
  });
};
