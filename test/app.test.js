import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/app.js');

test('GET /api/health returns service status', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.status, 'ok');
});

test('protected endpoints reject requests without a JWT', async () => {
  const response = await request(app).get('/api/leads').expect(401);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /token/i);
});

test('unknown endpoints return the standard 404 response', async () => {
  const response = await request(app).get('/api/does-not-exist').expect(404);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /route not found/i);
});

test('registration input is validated before database access', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: '', email: 'not-an-email', password: 'short' })
    .expect(422);

  assert.equal(response.body.success, false);
  assert.equal(response.body.message, 'Validation failed');
  assert.ok(response.body.errors.length >= 3);
});
