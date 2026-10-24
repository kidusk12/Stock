require('dotenv').config();

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(120000);

const stamp = Date.now();
const prefix = `Notifications Test ${stamp}`;

const NOTIFICATIONS_URL = '/api/notifications';
const LOW_STOCK_URL = '/api/low-stock';

const ids = {
  products: [],
  users: [],
  notifications: {},
};

const tokens = {};

const bearer = (token) => ({
  Authorization: `Bearer ${token}`,
});

const get = (token, path) =>
  request(app).get(path).set(bearer(token));

const post = (token, path) =>
  request(app).post(path).set(bearer(token));

const login = (username, password) =>
  request(app).post('/api/auth/login').send({ username, password });

function expectError(res, status, code) {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
}

async function createUser(label, role, branchId) {
  const username = `test-notification-${label}-${stamp}`;

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: `Notifications Test ${label}`,
      role,
      branchId,
    },
  });

  ids.users.push(user.id);

  const response = await login(username, 'Test12345');

  expect(response.status).toBe(200);
  tokens[label] = response.body.token;

  return user;
}

async function createProduct(label) {
  const product = await prisma.product.create({
    data: {
      name: `${prefix} ${label}`,
      sku: `NT-${stamp}-${label}`,
      unit: 'piece',
      costPrice: 1,
      sellingPrice: 2,
    },
  });

  ids.products.push(product.id);
  return product;
}

async function createStock(
  productId,
  branchId,
  { quantity, minQty, maxQty = null }
) {
  return prisma.branchStock.upsert({
    where: {
      productId_branchId: { productId, branchId },
    },
    create: {
      productId,
      branchId,
      quantity,
      minQty,
      maxQty,
      lowStockAlerted: quantity <= minQty && minQty > 0,
    },
    update: {
      quantity,
      minQty,
      maxQty,
      lowStockAlerted: quantity <= minQty && minQty > 0,
    },
  });
}

async function createNotification(
  productId,
  branchId,
  { quantity, minQty, isRead = false }
) {
  return prisma.notification.create({
    data: {
      type: 'LOW_STOCK',
      productId,
      branchId,
      quantity,
      minQty,
      isRead,
    },
  });
}

beforeAll(async () => {
  const branchA = await prisma.branch.create({
    data: {
      name: `${prefix} Branch A`,
      code: `NTA${stamp}`,
    },
  });

  const branchB = await prisma.branch.create({
    data: {
      name: `${prefix} Branch B`,
      code: `NTB${stamp}`,
    },
  });

  ids.A = branchA.id;
  ids.B = branchB.id;

  await createUser('managerA', 'BRANCH_MANAGER', ids.A);
  await createUser('managerB', 'BRANCH_MANAGER', ids.B);
  await createUser('staffA', 'STAFF', ids.A);
  await createUser('auditor', 'AUDITOR', null);

  const adminLogin = await login('admin', 'Admin123!');
  expect(adminLogin.status).toBe(200);
  tokens.admin = adminLogin.body.token;

  const lowA = await createProduct('LowA');
  const normalA = await createProduct('NormalA');
  const lowB = await createProduct('LowB');

  await createStock(lowA.id, ids.A, {
    quantity: 3,
    minQty: 5,
    maxQty: 20,
  });

  await createStock(normalA.id, ids.A, {
    quantity: 8,
    minQty: 5,
    maxQty: 20,
  });

  await createStock(lowB.id, ids.B, {
    quantity: 1,
    minQty: 4,
    maxQty: null,
  });

  ids.notifications.AUnread = (
    await createNotification(lowA.id, ids.A, {
      quantity: 3,
      minQty: 5,
      isRead: false,
    })
  ).id;

  ids.notifications.ARead = (
    await createNotification(normalA.id, ids.A, {
      quantity: 4,
      minQty: 5,
      isRead: true,
    })
  ).id;

  ids.notifications.BUnread = (
    await createNotification(lowB.id, ids.B, {
      quantity: 1,
      minQty: 4,
      isRead: false,
    })
  ).id;
});

afterAll(async () => {
  const productIds = ids.products;

  await prisma.notification.deleteMany({
    where: { productId: { in: productIds } },
  });

  await prisma.branchStock.deleteMany({
    where: { productId: { in: productIds } },
  });

  await prisma.product.deleteMany({
    where: { id: { in: productIds } },
  });

  await prisma.user.deleteMany({
    where: { id: { in: ids.users } },
  });

  if (ids.A && ids.B) {
    await prisma.branch.deleteMany({
      where: { id: { in: [ids.A, ids.B] } },
    });
  }

  await prisma.$disconnect();
});

test('authentication and role access are enforced', async () => {
  expect((await request(app).get(NOTIFICATIONS_URL)).status).toBe(401);
  expect((await request(app).get(LOW_STOCK_URL)).status).toBe(401);

  expectError(
    await get(tokens.staffA, NOTIFICATIONS_URL),
    403,
    'FORBIDDEN'
  );

  expectError(
    await post(tokens.staffA, `/api/notifications/${ids.notifications.AUnread}/read`),
    403,
    'FORBIDDEN'
  );

  expectError(
    await get(tokens.auditor, NOTIFICATIONS_URL),
    403,
    'FORBIDDEN'
  );

  expectError(
    await get(tokens.auditor, LOW_STOCK_URL),
    403,
    'FORBIDDEN'
  );
});

test('notification list returns snapshots, pagination, and unreadCount', async () => {
  const manager = await get(tokens.managerA, `${NOTIFICATIONS_URL}?limit=100`);

  expect(manager.status).toBe(200);
  expect(manager.body).toMatchObject({
    page: 1,
    limit: 100,
    total: 2,
    unreadCount: 1,
  });

  expect(manager.body.data.map((row) => row.id)).toContain(
    ids.notifications.AUnread
  );

  const unread = await get(
    tokens.managerA,
    `${NOTIFICATIONS_URL}?unread=true&limit=100`
  );

  expect(unread.status).toBe(200);
  expect(unread.body.total).toBe(1);
  expect(unread.body.data.every((row) => row.isRead === false)).toBe(true);

  const snapshot = unread.body.data[0];

  expect(snapshot).toMatchObject({
    id: ids.notifications.AUnread,
    type: 'LOW_STOCK',
    branchId: ids.A,
    branchName: `${prefix} Branch A`,
    quantity: 3,
    minQuantity: 5,
    isRead: false,
  });

  expect(snapshot.productName).toBe(`${prefix} LowA`);
  expect(snapshot.createdAt).toBeTruthy();

  // A Manager is restricted to their own branch.
  expectError(
    await get(
      tokens.managerA,
      `${NOTIFICATIONS_URL}?branchId=${ids.B}`
    ),
    403,
    'FORBIDDEN'
  );

  // Admin can filter notifications by branch.
  const admin = await get(
    tokens.admin,
    `${NOTIFICATIONS_URL}?branchId=${ids.A}&limit=100`
  );

  expect(admin.status).toBe(200);
  expect(admin.body.total).toBe(2);
  expect(admin.body.unreadCount).toBe(1);
});

test('notifications are newest first and invalid filters are rejected', async () => {
  const res = await get(tokens.managerA, `${NOTIFICATIONS_URL}?limit=100`);

  const times = res.body.data.map((row) => Date.parse(row.createdAt));

  expect(times).toEqual([...times].sort((a, b) => b - a));

  expectError(
    await get(tokens.admin, `${NOTIFICATIONS_URL}?branchId=abc`),
    400,
    'VALIDATION_ERROR'
  );

  expectError(
    await get(tokens.admin, `${NOTIFICATIONS_URL}?unread=false`),
    400,
    'VALIDATION_ERROR'
  );

  expectError(
    await get(tokens.admin, `${NOTIFICATIONS_URL}?limit=101`),
    400,
    'VALIDATION_ERROR'
  );
});

test('mark one notification read enforces branch access', async () => {
  const response = await post(
    tokens.managerA,
    `/api/notifications/${ids.notifications.AUnread}/read`
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ success: true });

  const saved = await prisma.notification.findUnique({
    where: { id: ids.notifications.AUnread },
  });

  expect(saved.isRead).toBe(true);

  expectError(
    await post(
      tokens.managerA,
      `/api/notifications/${ids.notifications.BUnread}/read`
    ),
    403,
    'FORBIDDEN'
  );

  expectError(
    await post(tokens.admin, '/api/notifications/999999999/read'),
    404,
    'NOT_FOUND'
  );
});

test('read-all marks only the notifications the Manager can access', async () => {
  const response = await post(
    tokens.managerA,
    '/api/notifications/read-all'
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ success: true });

  const branchAUnread = await prisma.notification.count({
    where: { branchId: ids.A, isRead: false },
  });

  const branchBUnread = await prisma.notification.count({
    where: { branchId: ids.B, isRead: false },
  });

  expect(branchAUnread).toBe(0);
  expect(branchBUnread).toBe(1);
});

test('low-stock list is calculated from current stock, not notifications', async () => {
  const manager = await get(
    tokens.managerA,
    `${LOW_STOCK_URL}?limit=100`
  );

  expect(manager.status).toBe(200);
  expect(manager.body.total).toBe(1);

  expect(manager.body.data[0]).toMatchObject({
    branchId: ids.A,
    branchName: `${prefix} Branch A`,
    productName: `${prefix} LowA`,
    sku: `NT-${stamp}-LowA`,
    quantity: 3,
    minQuantity: 5,
    maxQuantity: 20,
    suggestedReorderQuantity: 17,
  });

  // Admin can see a different branch.
  const admin = await get(
    tokens.admin,
    `${LOW_STOCK_URL}?branchId=${ids.B}&limit=100`
  );

  expect(admin.status).toBe(200);
  expect(admin.body.total).toBe(1);
  expect(admin.body.data[0]).toMatchObject({
    branchId: ids.B,
    quantity: 1,
    minQuantity: 4,
    maxQuantity: null,
    suggestedReorderQuantity: 7,
  });

  // Staff cannot access the low-stock endpoint.
  expectError(
    await get(tokens.staffA, LOW_STOCK_URL),
    403,
    'FORBIDDEN'
  );

  // A Manager cannot select another branch.
  expectError(
    await get(tokens.managerA, `${LOW_STOCK_URL}?branchId=${ids.B}`),
    403,
    'FORBIDDEN'
  );
});

test('low-stock query rejects invalid branch and category ids', async () => {
  expectError(
    await get(tokens.admin, `${LOW_STOCK_URL}?branchId=abc`),
    400,
    'VALIDATION_ERROR'
  );

  expectError(
    await get(tokens.admin, `${LOW_STOCK_URL}?categoryId=abc`),
    400,
    'VALIDATION_ERROR'
  );

  expectError(
    await get(tokens.admin, `${LOW_STOCK_URL}?limit=101`),
    400,
    'VALIDATION_ERROR'
  );
});
