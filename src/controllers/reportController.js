import mongoose from 'mongoose';
import Lead from '../models/Lead.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import LeadTransferLog from '../models/LeadTransferLog.js';
import { createWorkbookBuffer } from '../services/excelService.js';
import { buildAssignmentFilter, getManagedUserIds, isSuperAdmin } from '../utils/accessControl.js';
import { sendSuccess } from '../utils/apiResponse.js';

const aggregationScope = scope => {
  if (!scope.assignedTo?.$in) return scope;
  return {
    ...scope,
    assignedTo: {
      $in: scope.assignedTo.$in.map(id => new mongoose.Types.ObjectId(String(id)))
    }
  };
};

const withDateRange = (match, query, field = 'createdAt') => {
  if (!query.from && !query.to) return match;
  const range = {};
  if (query.from) range.$gte = new Date(query.from);
  if (query.to) {
    const end = new Date(query.to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return { ...match, [field]: range };
};

const getScopes = async req => ({
  lead: withDateRange(aggregationScope(await buildAssignmentFilter(req.user)), req.query),
  task: withDateRange(aggregationScope(await buildAssignmentFilter(req.user)), req.query)
});

const getLeadConversionData = async match => {
  const [result] = await Lead.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalLeads: { $sum: 1 },
        convertedLeads: { $sum: { $cond: [{ $in: ['$status', ['Booking Done', 'Closure']] }, 1, 0] } },
        lostLeads: { $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        totalLeads: 1,
        convertedLeads: 1,
        lostLeads: 1,
        conversionRate: {
          $cond: [
            { $eq: ['$totalLeads', 0] },
            0,
            { $round: [{ $multiply: [{ $divide: ['$convertedLeads', '$totalLeads'] }, 100] }, 2] }
          ]
        }
      }
    }
  ]);
  return result || { totalLeads: 0, convertedLeads: 0, lostLeads: 0, conversionRate: 0 };
};

const getPipelineData = match => Lead.aggregate([
  { $match: match },
  {
    $group: {
      _id: '$status',
      leads: { $sum: 1 },
      estimatedValue: { $sum: '$estimatedValue' },
      revenue: { $sum: '$revenue' }
    }
  },
  { $sort: { leads: -1 } }
]);

const getTaskCompletionData = async match => {
  const [summary, byStatus] = await Promise.all([
    Task.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
          overdueTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ['$dueDate', new Date()] },
                    { $not: [{ $in: ['$status', ['Completed', 'Cancelled']] }] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]),
    Task.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);
  const base = summary[0] || { totalTasks: 0, completedTasks: 0, overdueTasks: 0 };
  return {
    ...base,
    completionRate: base.totalTasks ? Number(((base.completedTasks / base.totalTasks) * 100).toFixed(2)) : 0,
    byStatus
  };
};

const getMonthlyLeadsData = match => Lead.aggregate([
  { $match: match },
  {
    $group: {
      _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
      leads: { $sum: 1 },
      converted: { $sum: { $cond: [{ $in: ['$status', ['Booking Done', 'Closure']] }, 1, 0] } }
    }
  },
  { $sort: { '_id.year': 1, '_id.month': 1 } }
]);

const getSourceData = match => Lead.aggregate([
  { $match: match },
  {
    $group: {
      _id: '$source',
      leads: { $sum: 1 },
      converted: { $sum: { $cond: [{ $in: ['$status', ['Booking Done', 'Closure']] }, 1, 0] } },
      revenue: { $sum: '$revenue' }
    }
  },
  { $sort: { leads: -1 } }
]);

const getRevenueData = async match => {
  const [summary, monthly] = await Promise.all([
    Lead.aggregate([
      { $match: { ...match, status: { $in: ['Booking Done', 'Closure'] } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$revenue' },
          totalEstimatedValue: { $sum: '$estimatedValue' },
          deals: { $sum: 1 },
          averageDealValue: { $avg: '$revenue' }
        }
      }
    ]),
    Lead.aggregate([
      { $match: { ...match, status: { $in: ['Booking Done', 'Closure'] } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$revenue' },
          deals: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ])
  ]);
  return {
    summary: summary[0] || { totalRevenue: 0, totalEstimatedValue: 0, deals: 0, averageDealValue: 0 },
    monthly
  };
};

const getUserPerformanceData = async (req, scopes) => {
  const userIds = isSuperAdmin(req.user) ? null : await getManagedUserIds(req.user);
  const userFilter = userIds ? { _id: { $in: userIds } } : {};
  const [users, leads, tasks] = await Promise.all([
    User.find(userFilter).select('name email role isActive').lean(),
    Lead.aggregate([
      { $match: scopes.lead },
      {
        $group: {
          _id: '$assignedTo',
          leads: { $sum: 1 },
          converted: { $sum: { $cond: [{ $in: ['$status', ['Booking Done', 'Closure']] }, 1, 0] } },
          revenue: { $sum: '$revenue' }
        }
      }
    ]),
    Task.aggregate([
      { $match: scopes.task },
      {
        $group: {
          _id: '$assignedTo',
          tasks: { $sum: 1 },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } }
        }
      }
    ])
  ]);
  const leadMap = new Map(leads.map(item => [String(item._id), item]));
  const taskMap = new Map(tasks.map(item => [String(item._id), item]));

  return users.map(user => {
    const lead = leadMap.get(String(user._id)) || {};
    const task = taskMap.get(String(user._id)) || {};
    return {
      ...user,
      leads: lead.leads || 0,
      converted: lead.converted || 0,
      conversionRate: lead.leads ? Number(((lead.converted / lead.leads) * 100).toFixed(2)) : 0,
      revenue: lead.revenue || 0,
      tasks: task.tasks || 0,
      completedTasks: task.completedTasks || 0,
      taskCompletionRate: task.tasks ? Number(((task.completedTasks / task.tasks) * 100).toFixed(2)) : 0
    };
  });
};

export const leadConversionReport = async (req, res) => {
  const scopes = await getScopes(req);
  return sendSuccess(res, { data: await getLeadConversionData(scopes.lead) });
};

export const pipelineReport = async (req, res) => {
  const scopes = await getScopes(req);
  return sendSuccess(res, { data: await getPipelineData(scopes.lead) });
};

export const taskCompletionReport = async (req, res) => {
  const scopes = await getScopes(req);
  return sendSuccess(res, { data: await getTaskCompletionData(scopes.task) });
};

export const userPerformanceReport = async (req, res) => {
  const scopes = await getScopes(req);
  return sendSuccess(res, { data: await getUserPerformanceData(req, scopes) });
};

export const monthlyLeadsReport = async (req, res) => {
  const scopes = await getScopes(req);
  return sendSuccess(res, { data: await getMonthlyLeadsData(scopes.lead) });
};

export const sourceWiseReport = async (req, res) => {
  const scopes = await getScopes(req);
  return sendSuccess(res, { data: await getSourceData(scopes.lead) });
};

export const revenueReport = async (req, res) => {
  const scopes = await getScopes(req);
  return sendSuccess(res, { data: await getRevenueData(scopes.lead) });
};

export const summaryReport = async (req, res) => {
  const scopes = await getScopes(req);
  const [conversion, pipeline, tasks, monthlyLeads, sources, revenue, users] = await Promise.all([
    getLeadConversionData(scopes.lead),
    getPipelineData(scopes.lead),
    getTaskCompletionData(scopes.task),
    getMonthlyLeadsData(scopes.lead),
    getSourceData(scopes.lead),
    getRevenueData(scopes.lead),
    getUserPerformanceData(req, scopes)
  ]);

  const [totalProperties, totalTransfers] = await Promise.all([
    Project.countDocuments(),
    LeadTransferLog.countDocuments()
  ]);
  return sendSuccess(res, {
    data: {
      totals: {
        totalUsers: users.length,
        totalLeads: conversion.totalLeads,
        totalProperties,
        totalTasks: tasks.totalTasks,
        totalTransfers
      },
      conversion,
      leadsByStatus: pipeline,
      leadsBySource: sources,
      tasksByStatus: tasks.byStatus,
      pipeline,
      tasks,
      monthlyLeads,
      sources,
      revenue,
      users
    }
  });
};

export const peopleReport = userPerformanceReport;

export const exportReports = async (req, res) => {
  const scopes = await getScopes(req);
  const [conversion, pipeline, tasks, monthlyLeads, sources, revenue, users] = await Promise.all([
    getLeadConversionData(scopes.lead),
    getPipelineData(scopes.lead),
    getTaskCompletionData(scopes.task),
    getMonthlyLeadsData(scopes.lead),
    getSourceData(scopes.lead),
    getRevenueData(scopes.lead),
    getUserPerformanceData(req, scopes)
  ]);

  const buffer = createWorkbookBuffer([
    { name: 'Conversion', rows: [conversion] },
    {
      name: 'Pipeline',
      rows: pipeline.map(row => ({
        Stage: row._id,
        Leads: row.leads,
        'Estimated Value': row.estimatedValue,
        Revenue: row.revenue
      }))
    },
    { name: 'Task Summary', rows: [{ ...tasks, byStatus: undefined }] },
    {
      name: 'Tasks by Status',
      rows: tasks.byStatus.map(row => ({ Status: row._id, Count: row.count }))
    },
    {
      name: 'Monthly Leads',
      rows: monthlyLeads.map(row => ({
        Year: row._id.year,
        Month: row._id.month,
        Leads: row.leads,
        Converted: row.converted
      }))
    },
    {
      name: 'Lead Sources',
      rows: sources.map(row => ({
        Source: row._id,
        Leads: row.leads,
        Converted: row.converted,
        Revenue: row.revenue
      }))
    },
    { name: 'Revenue Summary', rows: [revenue.summary] },
    {
      name: 'Monthly Revenue',
      rows: revenue.monthly.map(row => ({
        Year: row._id.year,
        Month: row._id.month,
        Revenue: row.revenue,
        Deals: row.deals
      }))
    },
    {
      name: 'User Performance',
      rows: users.map(({ _id, ...user }) => ({ UserId: String(_id), ...user }))
    }
  ]);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="crm-reports-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  return res.send(buffer);
};
