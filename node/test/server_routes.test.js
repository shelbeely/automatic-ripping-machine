const path = require('path');
const http = require('http');
const os = require('os');
const fs = require('fs');

const TEST_DB = path.join(os.tmpdir(), `arm_server_test_${Date.now()}.db`);

let app;
let server;

function request(pathStr) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    http.get(`http://127.0.0.1:${addr.port}${pathStr}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function postRequest(pathStr, data) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const postData = JSON.stringify(data);
    const options = {
      hostname: '127.0.0.1',
      port: addr.port,
      path: pathStr,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

beforeAll(async () => {
  const { createApp } = require('../src/ui/server');
  app = await createApp({ dbPath: TEST_DB });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => {
  if (server) server.close();
  const { closeDatabase } = require('../src/models/database');
  closeDatabase();
  try { fs.unlinkSync(TEST_DB); } catch (e) {}
});

describe('Server Routes', () => {
  test('GET / returns 200', async () => {
    const res = await request('/');
    expect(res.status).toBe(200);
    expect(res.body).toContain('ARM');
  });

  test('GET /activerips returns 200', async () => {
    const res = await request('/activerips');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Active Rips');
  });

  test('GET /history returns 200', async () => {
    const res = await request('/history');
    expect(res.status).toBe(200);
    expect(res.body).toContain('History');
  });

  test('GET /settings returns 200', async () => {
    const res = await request('/settings');
    expect(res.status).toBe(200);
  });

  test('GET /login returns 200', async () => {
    const res = await request('/login');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Login');
  });

  test('GET /logs returns 200', async () => {
    const res = await request('/logs');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Logs');
  });

  test('GET /notifications returns 200', async () => {
    const res = await request('/notifications');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Notifications');
  });

  test('GET /database returns 200 with table list', async () => {
    const res = await request('/database');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Tables');
    expect(res.body).toContain('job');
  });

  test('GET /database?table=job returns 200 with table data view', async () => {
    const res = await request('/database?table=job');
    expect(res.status).toBe(200);
    expect(res.body).toContain('job');
    expect(res.body).toContain('rows');
  });

  test('GET /systeminfo returns 200', async () => {
    const res = await request('/systeminfo');
    expect(res.status).toBe(200);
    expect(res.body).toContain('System Information');
  });

  test('GET /mcp/apps returns 200', async () => {
    const res = await request('/mcp/apps');
    expect(res.status).toBe(200);
    expect(res.body).toContain('MCP Apps');
  });
});

describe('AI Dashboard', () => {
  test('GET /ai returns 200 with AI Dashboard content', async () => {
    const res = await request('/ai');
    expect(res.status).toBe(200);
    expect(res.body).toContain('AI Dashboard');
    expect(res.body).toContain('AI Status');
    expect(res.body).toContain('Capabilities');
  });

  test('GET /ai shows AI configuration info', async () => {
    const res = await request('/ai');
    expect(res.status).toBe(200);
    expect(res.body).toContain('AI Configuration');
    expect(res.body).toContain('API URL');
    expect(res.body).toContain('gpt-4o-mini');
  });

  test('GET /ai shows all 5 AI capabilities', async () => {
    const res = await request('/ai');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Disc Identification');
    expect(res.body).toContain('Transcode Optimization');
    expect(res.body).toContain('Error Diagnosis');
    expect(res.body).toContain('Filename Generation');
    expect(res.body).toContain('Credits');
  });
});

describe('Setup Routes', () => {
  test('GET /setup returns 200 when no admin exists', async () => {
    const res = await request('/setup');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Initial Setup');
    expect(res.body).toContain('Create Account');
  });

  test('POST /setup creates admin and redirects to login', async () => {
    const res = await postRequest('/setup', { email: 'testadmin', password: 'testpass123' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('GET /setup redirects to login after admin exists', async () => {
    const res = await request('/setup');
    expect(res.status).toBe(302);
    expect(res.body).toContain('/login');
  });

  test('POST /setup redirects when admin already exists', async () => {
    const res = await postRequest('/setup', { email: 'anotheruser', password: 'pass' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});

describe('404 handling', () => {
  test('GET /nonexistent returns 404', async () => {
    const res = await request('/nonexistent-route-12345');
    expect(res.status).toBe(404);
  });
});
