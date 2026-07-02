import * as XLSX from 'xlsx';
import { LEAD_SOURCES, LEAD_STATUSES } from '../models/Lead.js';

const normalize = value => String(value ?? '').trim();
const normalizeEmail = value => normalize(value).toLowerCase();

const parseDate = value => {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseMoney = value => {
  if (value === '' || value === null || value === undefined) return undefined;
  const number = Number(String(value).replace(/[,\s₹$€£]/g, ''));
  return Number.isFinite(number) && number >= 0 ? number : undefined;
};

const safeCell = value => (
  typeof value === 'string' && /^[=+\-@]/.test(value) ? `'${value}` : value
);

export const readLeadWorkbook = buffer => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
};

export const validateLeadRows = (rows, options = {}) => {
  const maxRows = options.maxRows || 2000;
  const accepted = [];
  const errors = [];

  if (rows.length > maxRows) {
    return {
      accepted,
      errors: [{ row: 0, message: `The spreadsheet exceeds the ${maxRows}-row import limit` }]
    };
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = normalize(row.name || row.Name);
    const phone = normalize(row.phone || row.Phone);
    const email = normalizeEmail(row.email || row.Email);
    const source = normalize(row.source || row.Source) || 'Other';
    const status = normalize(row.status || row.Status) || 'New';
    const priority = normalize(row.priority || row.Priority) || 'Medium';
    const rowErrors = [];

    if (!name) rowErrors.push('name is required');
    if (!phone) rowErrors.push('phone is required');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push('email is invalid');
    if (!LEAD_SOURCES.includes(source)) rowErrors.push(`source must be one of: ${LEAD_SOURCES.join(', ')}`);
    if (!LEAD_STATUSES.includes(status)) rowErrors.push(`status must be one of: ${LEAD_STATUSES.join(', ')}`);
    if (!['Low', 'Medium', 'High', 'Hot'].includes(priority)) {
      rowErrors.push('priority must be Low, Medium, High, or Hot');
    }

    if (rowErrors.length) {
      errors.push({ row: rowNumber, message: rowErrors.join('; ') });
      return;
    }

    accepted.push({
      name,
      phone,
      email: email || undefined,
      source,
      status,
      priority,
      purpose: normalize(row.purpose || row.Purpose) || undefined,
      propertyType: normalize(row.propertyType || row['Property Type']) || undefined,
      configuration: normalize(row.configuration || row.Configuration) || undefined,
      requirement: normalize(row.requirement || row.Requirement) || undefined,
      budget: parseMoney(row.budget || row.Budget),
      budgetMax: parseMoney(row.budgetMax || row['Maximum Budget']),
      estimatedValue: parseMoney(row.estimatedValue || row['Estimated Value']),
      revenue: parseMoney(row.revenue || row.Revenue),
      preferredLocation: normalize(row.preferredLocation || row['Preferred Location']) || undefined,
      followUpDate: parseDate(row.followUpDate || row['Follow Up Date'])
    });
  });

  return { accepted, errors };
};

export const createWorkbookBuffer = (sheets) => {
  const workbook = XLSX.utils.book_new();

  for (const { name, rows } of sheets) {
    const safeRows = rows.map(row => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, safeCell(value)])
    ));
    const worksheet = XLSX.utils.json_to_sheet(safeRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

export const mapLeadsForExport = leads => leads.map(lead => ({
  Name: lead.name,
  Email: lead.email || '',
  Phone: lead.phone,
  Source: lead.source,
  Status: lead.status,
  Priority: lead.priority,
  Purpose: lead.purpose || '',
  'Property Type': lead.propertyType || '',
  Configuration: lead.configuration || '',
  Project: lead.project?.name || '',
  'Assigned To': lead.assignedTo?.name || '',
  'Follow Up Date': lead.followUpDate || lead.nextFollowUp || '',
  'Estimated Value': lead.estimatedValue || 0,
  'Minimum Budget': lead.budget || 0,
  'Maximum Budget': lead.budgetMax || 0,
  Revenue: lead.revenue || 0,
  Requirement: lead.requirement || '',
  'Created At': lead.createdAt
}));
