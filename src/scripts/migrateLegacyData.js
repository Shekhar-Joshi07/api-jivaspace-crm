import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Lead from '../models/Lead.js';
import Task from '../models/Task.js';
import User from '../models/User.js';

try {
  await connectDB();

  const superadmin = await User.findOne({ role: { $in: ['superadmin', 'admin'] } }).sort('createdAt');
  if (!superadmin) throw new Error('Create a superadmin user before running the migration');

  const [executiveRoles, activeUsers, leadOwners, followUps, taskOwners, taskLeads] = await Promise.all([
    User.updateMany(
      { role: { $in: ['agent', 'business_executive'] } },
      { $set: { role: 'sales_executive' } },
      { runValidators: false }
    ),
    User.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } }),
    Lead.updateMany({ createdBy: { $exists: false } }, { $set: { createdBy: superadmin._id } }),
    Lead.updateMany(
      { followUpDate: { $exists: false }, nextFollowUp: { $exists: true } },
      [{ $set: { followUpDate: '$nextFollowUp' } }]
    ),
    Task.updateMany({ createdBy: { $exists: false } }, { $set: { createdBy: superadmin._id } }),
    Task.updateMany(
      { relatedLead: { $exists: false }, lead: { $exists: true } },
      [{ $set: { relatedLead: '$lead' } }]
    )
  ]);

  const superadminRole = await User.updateOne(
    { _id: superadmin._id, role: 'admin' },
    { $set: { role: 'superadmin' } },
    { runValidators: false }
  );

  console.log('Legacy migration completed', {
    roles: executiveRoles.modifiedCount + superadminRole.modifiedCount,
    activeUsers: activeUsers.modifiedCount,
    leadOwners: leadOwners.modifiedCount,
    followUps: followUps.modifiedCount,
    taskOwners: taskOwners.modifiedCount,
    taskLeads: taskLeads.modifiedCount
  });
} catch (error) {
  console.error('Legacy migration failed:', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
