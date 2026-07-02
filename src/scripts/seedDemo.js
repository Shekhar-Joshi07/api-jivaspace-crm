import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Lead from '../models/Lead.js';
import Property from '../models/Property.js';
import Task from '../models/Task.js';
import Team from '../models/Team.js';
import LeadTransferLog from '../models/LeadTransferLog.js';
import { connectDB } from '../config/db.js';

dotenv.config();

const demoPassword = 'Demo@123';

const users = [
  {
    name: 'Demo Superadmin',
    email: 'superadmin@jivaspace.com',
    password: demoPassword,
    role: 'superadmin',
    phone: '9000000001'
  },
  {
    name: 'Meera Admin',
    email: 'admin@jivaspace.com',
    password: demoPassword,
    role: 'admin',
    phone: '9000000002'
  },
  {
    name: 'Aarav Business Executive',
    email: 'executive@jivaspace.com',
    password: demoPassword,
    role: 'business_executive',
    phone: '9000000003'
  },
  {
    name: 'Ishita Business Executive',
    email: 'executive2@jivaspace.com',
    password: demoPassword,
    role: 'business_executive',
    phone: '9000000004'
  }
];

const properties = [
  {
    title: 'Jivaspace Sky Court 3BHK',
    type: 'Apartment',
    location: 'Noida Sector 150',
    price: 12500000,
    size: '1825 sq ft',
    bedrooms: 3,
    status: 'Available',
    description: 'Premium apartment with club access and expressway connectivity.',
    ownerName: 'Rakesh Mehra',
    ownerPhone: '9811100011'
  },
  {
    title: 'Green Vista Villa',
    type: 'Villa',
    location: 'Gurugram Golf Course Extension',
    price: 32000000,
    size: '3600 sq ft',
    bedrooms: 4,
    status: 'Booked',
    description: 'Independent villa with private lawn and modular kitchen.',
    ownerName: 'Neha Khanna',
    ownerPhone: '9811100012'
  },
  {
    title: 'Metro Square Commercial Office',
    type: 'Office',
    location: 'Delhi Aerocity',
    price: 18500000,
    size: '1450 sq ft',
    bedrooms: 0,
    status: 'Available',
    description: 'Ready-to-move office floor near metro and airport corridor.',
    ownerName: 'Sahil Arora',
    ownerPhone: '9811100013'
  },
  {
    title: 'Palm Residency Plot',
    type: 'Plot',
    location: 'Yamuna Expressway',
    price: 7200000,
    size: '180 sq yd',
    bedrooms: 0,
    status: 'Hold',
    description: 'Residential plot inside gated township.',
    ownerName: 'Kavita Rao',
    ownerPhone: '9811100014'
  }
];

const leads = [
  {
    name: 'Abhishek Srivastava',
    phone: '7900000001',
    email: 'abhishek@example.com',
    source: 'Website',
    requirement: '3BHK apartment',
    budget: 13000000,
    preferredLocation: 'Noida Sector 150',
    status: 'Contacted',
    nextFollowUpOffset: 1
  },
  {
    name: 'Aaradhana Singh',
    phone: '7900000002',
    email: 'aaradhana@example.com',
    source: 'Instagram',
    requirement: 'Villa',
    budget: 35000000,
    preferredLocation: 'Gurugram',
    status: 'Site Visit',
    nextFollowUpOffset: 2
  },
  {
    name: 'Akshay Saxena',
    phone: '7900000003',
    email: 'akshay@example.com',
    source: 'Google Ads',
    requirement: 'Commercial office',
    budget: 18000000,
    preferredLocation: 'Aerocity',
    status: 'Negotiation',
    nextFollowUpOffset: 3
  },
  {
    name: 'CA Saurabh Agrawal',
    phone: '7900000004',
    email: 'saurabh@example.com',
    source: 'Referral',
    requirement: 'Investment plot',
    budget: 7500000,
    preferredLocation: 'Yamuna Expressway',
    status: 'New',
    nextFollowUpOffset: 0
  },
  {
    name: 'Chaitanya Verma',
    phone: '7900000005',
    email: 'chaitanya@example.com',
    source: 'Facebook',
    requirement: '2BHK apartment',
    budget: 8500000,
    preferredLocation: 'Noida',
    status: 'Lost',
    nextFollowUpOffset: 4
  },
  {
    name: 'Priya Sharma',
    phone: '7900000006',
    email: 'priya@example.com',
    source: 'Walk-in',
    requirement: 'Ready-to-move 3BHK',
    budget: 14000000,
    preferredLocation: 'Noida Expressway',
    status: 'Converted',
    nextFollowUpOffset: 5
  },
  {
    name: 'Rohan Malhotra',
    phone: '7900000007',
    email: 'rohan@example.com',
    source: 'Website',
    requirement: 'Shop',
    budget: 9000000,
    preferredLocation: 'Delhi NCR',
    status: 'Contacted',
    nextFollowUpOffset: 1
  },
  {
    name: 'Sanya Mehta',
    phone: '7900000008',
    email: 'sanya@example.com',
    source: 'Other',
    requirement: 'Luxury villa',
    budget: 40000000,
    preferredLocation: 'Gurugram',
    status: 'Site Visit',
    nextFollowUpOffset: 6
  }
];

const taskTemplates = [
  { title: 'Call Abhishek about Sky Court pricing', priority: 'High', status: 'Pending', dueOffset: 1, leadPhone: '7900000001' },
  { title: 'Confirm Aaradhana villa site visit', priority: 'High', status: 'Pending', dueOffset: 2, leadPhone: '7900000002' },
  { title: 'Send office floor proposal to Akshay', priority: 'Medium', status: 'Pending', dueOffset: 3, leadPhone: '7900000003' },
  { title: 'Collect plot documents for Saurabh', priority: 'Medium', status: 'Pending', dueOffset: 4, leadPhone: '7900000004' },
  { title: 'Close payment follow-up with Priya', priority: 'High', status: 'Completed', dueOffset: -1, leadPhone: '7900000006' },
  { title: 'Share commercial inventory with Rohan', priority: 'Low', status: 'Pending', dueOffset: 5, leadPhone: '7900000007' }
];

const teamTemplates = [
  {
    name: 'North Zone Sales',
    description: 'Handles Noida, Delhi, and Yamuna Expressway lead operations.',
    status: 'Active'
  },
  {
    name: 'Luxury Homes Desk',
    description: 'Handles villa, premium apartment, and high-budget walk-in customers.',
    status: 'Active'
  }
];

function dateWithOffset(days) {
  const date = new Date();
  date.setHours(10, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

async function upsertUsers() {
  const created = [];

  for (const userData of users) {
    let user = await User.findOne({ email: userData.email });

    if (!user) {
      user = await User.create(userData);
    } else {
      user.name = userData.name;
      user.role = userData.role;
      user.phone = userData.phone;
      user.password = userData.password;
      await user.save();
    }

    created.push(user);
  }

  return created;
}

async function upsertProperties(superadmin) {
  const created = [];

  for (const propertyData of properties) {
    const property = await Property.findOneAndUpdate(
      { title: propertyData.title },
      { ...propertyData, createdBy: superadmin._id },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    created.push(property);
  }

  return created;
}

async function upsertLeads(superadmin, businessExecutive, propertyDocs) {
  const created = [];

  for (let index = 0; index < leads.length; index += 1) {
    const leadData = leads[index];
    const interestedProperty = propertyDocs[index % propertyDocs.length]?._id;
    const lead = await Lead.findOneAndUpdate(
      { phone: leadData.phone },
      {
        ...leadData,
        assignedTo: businessExecutive._id,
        createdBy: superadmin._id,
        interestedProperty,
        followUpDate: dateWithOffset(leadData.nextFollowUpOffset),
        nextFollowUp: dateWithOffset(leadData.nextFollowUpOffset),
        notes: [
          {
            text: `Demo note for ${leadData.requirement}.`,
            createdBy: businessExecutive._id
          }
        ]
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    created.push(lead);
  }

  return created;
}

async function upsertTasks(superadmin, businessExecutive, leadDocs) {
  const leadByPhone = new Map(leadDocs.map(lead => [lead.phone, lead]));
  const created = [];

  for (const taskData of taskTemplates) {
    const lead = leadByPhone.get(taskData.leadPhone);
    const task = await Task.findOneAndUpdate(
      { title: taskData.title, assignedTo: businessExecutive._id },
      {
        title: taskData.title,
        lead: lead?._id,
        relatedLead: lead?._id,
        assignedTo: businessExecutive._id,
        dueDate: dateWithOffset(taskData.dueOffset),
        priority: taskData.priority,
        status: taskData.status,
        createdBy: superadmin._id
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    created.push(task);
  }

  return created;
}

async function upsertTeams(superadmin, admin, businessExecutive, secondBusinessExecutive) {
  const created = [];

  for (const teamData of teamTemplates) {
    const team = await Team.findOneAndUpdate(
      { name: teamData.name },
      {
        ...teamData,
        manager: admin._id,
        members: [admin._id, businessExecutive._id, secondBusinessExecutive._id],
        createdBy: superadmin._id
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    created.push(team);
  }

  return created;
}

async function upsertTransferLogs(superadmin, businessExecutive, leadDocs) {
  const transferLeads = leadDocs.slice(0, 2);
  const created = [];

  for (const lead of transferLeads) {
    const log = await LeadTransferLog.findOneAndUpdate(
      { lead: lead._id, toUser: businessExecutive._id, reason: 'Demo assignment for active follow-up' },
      {
        lead: lead._id,
        fromUser: superadmin._id,
        toUser: businessExecutive._id,
        transferredBy: superadmin._id,
        reason: 'Demo assignment for active follow-up'
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    created.push(log);
  }

  return created;
}

try {
  await connectDB();

  const [superadmin, admin, businessExecutive, secondBusinessExecutive] = await upsertUsers();
  const propertyDocs = await upsertProperties(superadmin);
  const leadDocs = await upsertLeads(superadmin, businessExecutive, propertyDocs);
  const taskDocs = await upsertTasks(superadmin, businessExecutive, leadDocs);
  const teamDocs = await upsertTeams(superadmin, admin, businessExecutive, secondBusinessExecutive);
  const transferDocs = await upsertTransferLogs(superadmin, businessExecutive, leadDocs);

  console.log('Demo collections are ready.');
  console.log(`Users: ${users.length}`);
  console.log(`Properties: ${propertyDocs.length}`);
  console.log(`Leads: ${leadDocs.length}`);
  console.log(`Tasks: ${taskDocs.length}`);
  console.log(`Teams: ${teamDocs.length}`);
  console.log(`Transfer Logs: ${transferDocs.length}`);
  console.log('Login email: superadmin@jivaspace.com');
  console.log(`Login password: ${demoPassword}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
