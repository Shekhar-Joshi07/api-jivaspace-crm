import Activity from '../models/Activity.js';

export const recordActivity = async ({
  lead,
  project,
  propertyUnit,
  siteVisit,
  booking,
  task,
  user,
  type,
  description,
  channel,
  direction,
  outcome,
  durationSeconds,
  metadata = {}
}) => Activity.create({
  lead,
  project,
  propertyUnit,
  siteVisit,
  booking,
  task,
  user,
  type,
  description,
  channel,
  direction,
  outcome,
  durationSeconds,
  metadata
});
