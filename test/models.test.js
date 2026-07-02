import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Lead from '../src/models/Lead.js';
import Task from '../src/models/Task.js';
import User, { USER_ROLES, normalizeUserRole } from '../src/models/User.js';

const id = () => new mongoose.Types.ObjectId();

test('CRM models accept the required production fields', async () => {
  const owner = id();
  const lead = new Lead({
    name: 'Asha Rao',
    phone: '9000000000',
    status: 'Negotiation',
    priority: 'High',
    assignedTo: owner,
    createdBy: owner,
    followUpDate: new Date()
  });
  const task = new Task({
    title: 'Send revised proposal',
    assignedTo: owner,
    relatedLead: lead._id,
    dueDate: new Date(),
    status: 'In Progress',
    createdBy: owner
  });

  await lead.validate();
  await task.validate();
  assert.equal(lead.nextFollowUp.getTime(), lead.followUpDate.getTime());
  assert.equal(String(task.lead), String(task.relatedLead));
});

test('unsupported user roles fail model validation', async () => {
  const user = new User({
    name: 'Legacy User',
    email: 'legacy@example.com',
    password: 'Password123',
    role: 'owner'
  });

  await assert.rejects(user.validate(), /not a valid enum value/);
});

test('User uses the three real-estate CRM roles and normalizes legacy role values', () => {
  assert.deepEqual(USER_ROLES, [
    'superadmin',
    'admin',
    'sales_executive'
  ]);
  assert.equal(normalizeUserRole('Manager'), 'admin');
  assert.equal(normalizeUserRole('Team Leader'), 'admin');
  assert.equal(normalizeUserRole('business_executive'), 'sales_executive');
  assert.equal(normalizeUserRole('telecaller'), 'sales_executive');
});
