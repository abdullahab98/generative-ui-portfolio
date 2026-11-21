import assert from 'node:assert/strict';
import test from 'node:test';

// Provide minimal dummy env vars so app.ts can boot without live secrets
process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key-placeholder';

const { app } = await import('./app.js');

test('Express API smoke checks', async (t) => {
  const server = app.listen(0);
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;

  t.after(() => {
    server.close();
  });

  await t.test('GET /health returns 200 ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; service: string };
    assert.equal(body.ok, true);
    assert.equal(body.service, 'portfolio-api');
  });

  await t.test('POST /api/v1/contact rejects invalid payload with 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender_name: 'A', sender_email: 'not-an-email', message: 'hi' }),
    });
    assert.equal(res.status, 400);
  });

  await t.test('GET /api/v1/admin/profile rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/profile`);
    assert.equal(res.status, 401);
  });
});
