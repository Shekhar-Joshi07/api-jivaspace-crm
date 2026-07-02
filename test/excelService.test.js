import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWorkbookBuffer,
  readLeadWorkbook,
  validateLeadRows
} from '../src/services/excelService.js';

test('lead spreadsheet can be generated and read back', () => {
  const buffer = createWorkbookBuffer([{
    name: 'Leads',
    rows: [{ name: 'Asha Rao', phone: '9000000000', status: 'New' }]
  }]);
  const rows = readLeadWorkbook(buffer);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Asha Rao');
  assert.equal(rows[0].phone, '9000000000');
});

test('lead import validation separates accepted and invalid rows', () => {
  const result = validateLeadRows([
    { name: 'Asha Rao', phone: '9000000000', source: 'Website', status: 'Negotiation' },
    { name: '', phone: '', source: 'Unknown' }
  ]);

  assert.equal(result.accepted.length, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /name is required/);
});
