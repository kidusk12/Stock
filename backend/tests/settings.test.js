// Follows docs/api-contract.md v5, section 6.1 and scenario 1 in 6.10.
// Changes the real settings row (id 1) and puts the editable fields back at the end.
// Needs the seeded admin and settings row (npm run seed).
require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(120000);

const stamp = Date.now();
const URL = '/api/settings/company';
const tokens = {};
const userIds = [];
let branchId;
let original;

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const get = (token) => request(app).get(URL).set(bearer(token));
const put = (token, body) => request(app).put(URL).set(bearer(token)).send(body);
const login = (username, password) => request(app).post('/api/auth/login').send({ username, password });

const valid = {
  companyName: `Settings Test ${stamp}`,
  address: 'Bole, Addis Ababa',
  phone: '+251911000000',
  tin: '0012345678',
  taxType: 'TOT',
  taxRate: 2,
};

// A 400 must be a VALIDATION_ERROR whose first detail has this field (and rule, when given)
function expectValidation(res, field, rule) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details[0].field).toBe(field);
  if (rule) expect(res.body.error.details[0].rule).toBe(rule);
}

const row = () => prisma.companySetting.findUnique({ where: { id: 1 } });

async function createUser(label, role, userBranchId) {
  const user = await prisma.user.create({
    data: {
      username: `test-settings-${label}-${stamp}`,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: `Settings Test ${label}`,
      role,
      branchId: userBranchId,
    },
  });
  userIds.push(user.id);
  tokens[label] = (await login(user.username, 'Test12345')).body.token;
}

beforeAll(async () => {
  original = await row();
  if (!original) throw new Error('The settings row (id 1) is missing. Run npm run seed first.');

  branchId = (await prisma.branch.create({ data: { name: `Settings Test Branch ${stamp}`, code: `ST${stamp}` } })).id;
  await createUser('manager', 'BRANCH_MANAGER', branchId);
  await createUser('staff', 'STAFF', branchId);
  await createUser('auditor', 'AUDITOR', null);
  tokens.admin = (await login('admin', 'Admin123!')).body.token;
});

afterAll(async () => {
  // Put the editable fields back. nextInvoiceNumber is never touched.
  if (original) {
    await prisma.companySetting.update({
      where: { id: 1 },
      data: {
        companyName: original.companyName,
        address: original.address,
        phone: original.phone,
        tin: original.tin,
        taxType: original.taxType,
        taxRate: original.taxRate,
      },
    });
  }
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.branch.deleteMany({ where: { id: branchId } });
  await prisma.$disconnect();
});

test('an anonymous user is blocked; Manager, Staff and Auditor get 403 on read and change', async () => {
  expect((await request(app).get(URL)).status).toBe(401);
  expect((await request(app).put(URL).send(valid)).status).toBe(401);

  const before = await row();
  for (const label of ['manager', 'staff', 'auditor']) {
    const read = await get(tokens[label]);
    expect(read.status).toBe(403);
    expect(read.body.error.code).toBe('FORBIDDEN');

    const write = await put(tokens[label], valid);
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe('FORBIDDEN');
  }

  // Role is checked before the body: a bad body from Staff is still 403, not 400
  expect((await put(tokens.staff, {})).status).toBe(403);

  const after = await row();
  expect(after.companyName).toBe(before.companyName);
  expect(after.taxType).toBe(before.taxType);
});

test('GET returns the contract object with taxRate as a percentage and the default rates', async () => {
  const res = await get(tokens.admin);
  expect(res.status).toBe(200);

  const saved = await row();
  expect(res.body).toEqual({
    companyName: saved.companyName,
    address: saved.address,
    phone: saved.phone,
    tin: saved.tin,
    taxType: saved.taxType,
    taxRate: saved.taxRate.mul(100).toNumber(),
    defaultTaxRates: { VAT: 15, TOT: 2 },
    updatedAt: saved.updatedAt.toISOString(),
  });
  expect(res.body).not.toHaveProperty('nextInvoiceNumber');
  expect(res.body).not.toHaveProperty('id');
});

test('scenario 1: Admin sets TOT 2%, the database stores a fraction, and GET shows the change', async () => {
  const counterBefore = (await row()).nextInvoiceNumber;

  // defaultTaxRates and nextInvoiceNumber in the body are ignored
  const res = await put(tokens.admin, {
    ...valid,
    companyName: `  ${valid.companyName}  `,
    defaultTaxRates: { VAT: 99, TOT: 99 },
    nextInvoiceNumber: 5000,
  });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ ...valid, defaultTaxRates: { VAT: 15, TOT: 2 } });
  expect(res.body.updatedAt).toBeTruthy();
  expect(res.body).not.toHaveProperty('nextInvoiceNumber');

  const saved = await row();
  expect(saved.taxType).toBe('TOT');
  expect(saved.taxRate.toNumber()).toBe(0.02); // fraction in the database
  expect(saved.nextInvoiceNumber).toBe(counterBefore); // the counter never changes here

  const read = await get(tokens.admin);
  expect(read.body).toMatchObject(valid);
});

test('PUT replaces the editable fields: left out, null or empty optional fields become null', async () => {
  const base = { companyName: valid.companyName, taxType: 'VAT', taxRate: 15 };

  const omitted = await put(tokens.admin, base);
  expect(omitted.status).toBe(200);
  expect(omitted.body).toMatchObject({ address: null, phone: null, tin: null, taxType: 'VAT', taxRate: 15 });

  await put(tokens.admin, valid); // fill them again
  const nulls = await put(tokens.admin, { ...base, address: null, phone: null, tin: null });
  expect(nulls.status).toBe(200);
  expect(nulls.body).toMatchObject({ address: null, phone: null, tin: null });

  await put(tokens.admin, valid);
  const empty = await put(tokens.admin, { ...base, address: '', phone: '   ', tin: '' });
  expect(empty.status).toBe(200);
  expect(empty.body).toMatchObject({ address: null, phone: null, tin: null });

  const saved = await row();
  expect(saved.address).toBeNull();
  expect(saved.tin).toBeNull();
});

test('taxRate accepts 0 to 100 with two decimals and is stored as a fraction', async () => {
  const cases = [
    [0, 0],
    [0.01, 0.0001],
    [2.5, 0.025],
    [15, 0.15],
    [100, 1],
  ];
  for (const [percent, fraction] of cases) {
    const res = await put(tokens.admin, { ...valid, taxRate: percent });
    expect(res.status).toBe(200);
    expect(res.body.taxRate).toBe(percent);
    expect((await row()).taxRate.toNumber()).toBe(fraction);
  }
});

test('validation gives the right field', async () => {
  const before = await row();
  const bad = (override) => put(tokens.admin, { ...valid, ...override });

  expectValidation(await bad({ companyName: undefined }), 'companyName', 'required');
  expectValidation(await bad({ companyName: '' }), 'companyName');
  expectValidation(await bad({ companyName: 'x'.repeat(151) }), 'companyName', 'too_long');
  expectValidation(await bad({ tin: 'x'.repeat(21) }), 'tin', 'too_long');
  expectValidation(await bad({ address: 'x'.repeat(301) }), 'address', 'too_long');
  expectValidation(await bad({ phone: 'x'.repeat(31) }), 'phone', 'too_long');

  expectValidation(await bad({ taxType: undefined }), 'taxType', 'required');
  expectValidation(await bad({ taxType: 'GST' }), 'taxType', 'invalid');
  expectValidation(await bad({ taxRate: undefined }), 'taxRate', 'required');
  expectValidation(await bad({ taxRate: 'abc' }), 'taxRate', 'invalid');
  expectValidation(await bad({ taxRate: 2.555 }), 'taxRate', 'invalid');
  expectValidation(await bad({ taxRate: -1 }), 'taxRate');
  expectValidation(await bad({ taxRate: 100.01 }), 'taxRate');

  // Nothing was saved by any of the failed requests
  const after = await row();
  expect(after.companyName).toBe(before.companyName);
  expect(after.taxRate.toNumber()).toBe(before.taxRate.toNumber());
  expect(after.taxType).toBe(before.taxType);
});