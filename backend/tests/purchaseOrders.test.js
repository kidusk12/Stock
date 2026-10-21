
require('dotenv').config();

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

describe('Purchase Orders API', () => {
  let adminToken;
  let managerToken;
  let staffToken;
  let auditorToken;
  let managerBToken;

  let branchA;
  let branchB;
  let supplier;
  let product;
  let productB;

  let managerA;
  let managerB;
  let staffA;
  let auditor;

const password = 'Test12345';

async function login(username, loginPassword = password) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password: loginPassword });

  expect(response.status).toBe(200);
  return response.body.token;
}

  async function createBranch(name, code) {
    return prisma.branch.create({
      data: {
        name,
        code,
        isActive: true,
      },
    });
  }

  
async function createUser(username, role, branchId) {
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      username,
      passwordHash,
      fullName: `Purchase Order Test ${username}`,
      role,
      branchId,
    },
  });
}

  async function createSupplier(name) {
    return prisma.supplier.create({
      data: {
        name,
        isActive: true,
      },
    });
  }

  async function createProduct(name, sku) {
    return prisma.product.create({
      data: {
        name,
        sku,
        unit: 'piece',
        costPrice: 1,
        sellingPrice: 10,
        isActive: true,
      },
    });
  }

  async function createPO(token, overrides = {}) {
    return request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId: supplier.id,
        items: [
          {
            productId: product.id,
            quantity: 10,
            unitCost: 25,
          },
        ],
        ...overrides,
      });
  }

  async function createPendingPO(token = managerToken) {
    const response = await createPO(token);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('PENDING_APPROVAL');
    return response.body;
  }

  async function approvePO(token, id) {
    return request(app)
      .post(`/api/purchase-orders/${id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send();
  }

  async function receivePO(token, id, body) {
    const req = request(app)
      .post(`/api/purchase-orders/${id}/receive`)
      .set('Authorization', `Bearer ${token}`);

    return body === undefined ? req.send() : req.send(body);
  }

  beforeAll(async () => {
    // The test database must already contain the standard admin account.
    adminToken = await login('admin', 'Admin123!');

    branchA = await createBranch(
      `PO Test Branch A ${Date.now()}`,
      `POA${Date.now()}`
    );

    branchB = await createBranch(
      `PO Test Branch B ${Date.now()}`,
      `POB${Date.now()}`
    );

    managerA = await createUser(
      `po_manager_a_${Date.now()}`,
      'BRANCH_MANAGER',
      branchA.id
    );

    staffA = await createUser(
      `po_staff_a_${Date.now()}`,
      'STAFF',
      branchA.id
    );

    managerB = await createUser(
      `po_manager_b_${Date.now()}`,
      'BRANCH_MANAGER',
      branchB.id
    );

    auditor = await createUser(
      `po_auditor_${Date.now()}`,
      'AUDITOR',
      null
    );

    managerToken = await login(managerA.username);
    staffToken = await login(staffA.username);
    managerBToken = await login(managerB.username);
    auditorToken = await login(auditor.username);

    supplier = await createSupplier(`PO Test Supplier ${Date.now()}`);
    product = await createProduct(
      `PO Test Product ${Date.now()}`,
      `POSKU${Date.now()}`
    );

    productB = await createProduct(
      `PO Test Product B ${Date.now()}`,
      `POSKUB${Date.now()}`
    );
  });

  afterAll(async () => {
  try {
    if (branchA && branchB) {
      const branchIds = [branchA.id, branchB.id];
      const productIds = [product?.id, productB?.id].filter(Boolean);
      const userIds = [
        managerA?.id,
        managerB?.id,
        staffA?.id,
        auditor?.id,
      ].filter(Boolean);

      const purchaseOrders = await prisma.purchaseOrder.findMany({
        where: { branchId: { in: branchIds } },
        select: { id: true },
      });

      const poIds = purchaseOrders.map((po) => po.id);

      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: userIds } },
            {
              entityType: 'PURCHASE_ORDER',
              entityId: { in: poIds },
            },
          ],
        },
      });

      await prisma.purchaseOrderItem.deleteMany({
        where: {
          purchaseOrder: {
            branchId: { in: branchIds },
          },
        },
      });

      await prisma.purchaseOrder.deleteMany({
        where: { branchId: { in: branchIds } },
      });

      await prisma.stockMovement.deleteMany({
        where: {
          OR: [
            { userId: { in: userIds } },
            { productId: { in: productIds } },
          ],
        },
      });

      if (productIds.length) {
        await prisma.branchStock.deleteMany({
          where: { productId: { in: productIds } },
        });
      }

      if (userIds.length) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
      }

      if (productIds.length) {
        await prisma.product.deleteMany({
          where: { id: { in: productIds } },
        });
      }

      if (supplier) {
        await prisma.supplier.deleteMany({
          where: { id: supplier.id },
        });
      }

      await prisma.branch.deleteMany({
        where: { id: { in: branchIds } },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
});

  describe('POST /api/purchase-orders', () => {
    test('allows Admin to create a PO with an explicit branch', async () => {
      const response = await createPO(adminToken, {
        branchId: branchA.id,
      });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('PENDING_APPROVAL');
      expect(response.body.branchId).toBe(branchA.id);
      expect(response.body.poNumber).toMatch(/^PO-\d{6}$/);
      expect(Number(response.body.totalCost)).toBe(250);
    });

    test('requires Admin to provide branchId', async () => {
      const response = await createPO(adminToken);

      expect(response.status).toBe(400);
    });

    test('allows Manager to create a PO for their own branch', async () => {
      const response = await createPO(managerToken);

      expect(response.status).toBe(201);
      expect(response.body.branchId).toBe(branchA.id);
    });

    test('allows Staff to create a PO for their own branch', async () => {
      const response = await createPO(staffToken);

      expect(response.status).toBe(201);
      expect(response.body.branchId).toBe(branchA.id);
    });

    test('rejects Auditor writes', async () => {
      const response = await createPO(auditorToken);

      expect(response.status).toBe(403);
    });

    test('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/purchase-orders')
        .send({
          supplierId: supplier.id,
          branchId: branchA.id,
          items: [
            {
              productId: product.id,
              quantity: 1,
              unitCost: 5,
            },
          ],
        });

      expect(response.status).toBe(401);
    });

    test('rejects a Manager trying to create a PO for another branch', async () => {
      const response = await createPO(managerToken, {
        branchId: branchB.id,
      });

      expect(response.status).toBe(403);
    });

    test.each([
      ['empty items', { items: [] }],
      ['zero quantity', {
        items: [{ productId: 1, quantity: 0, unitCost: 5 }],
      }],
      ['negative quantity', {
        items: [{ productId: 1, quantity: -1, unitCost: 5 }],
      }],
      ['negative unit cost', {
        items: [{ productId: 1, quantity: 1, unitCost: -5 }],
      }],
      ['quantity with excess decimals', {
        items: [{ productId: 1, quantity: 1.234, unitCost: 5 }],
      }],
      ['unit cost with excess decimals', {
        items: [{ productId: 1, quantity: 1, unitCost: 5.678 }],
      }],
      ['note longer than 500 characters', { note: 'x'.repeat(501) }],
    ])('validates %s', async (_description, invalidFields) => {
      const response = await createPO(managerToken, invalidFields);

      expect(response.status).toBe(400);
    });

    test('returns 404 for a nonexistent supplier', async () => {
      const response = await createPO(managerToken, {
        supplierId: 999999999,
      });

      expect(response.status).toBe(404);
    });

    test('returns 404 for a nonexistent product', async () => {
      const response = await createPO(managerToken, {
        items: [
          { productId: 999999999, quantity: 1, unitCost: 5 },
        ],
      });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/purchase-orders', () => {
    test('allows Admin to list purchase orders across branches', async () => {
      await createPendingPO(managerToken);

      const response = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    test('allows Auditor to list purchase orders across branches', async () => {
      const response = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(response.status).toBe(200);
    });

    test('limits Manager to their own branch', async () => {
      const response = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);

      const orders = Array.isArray(response.body)
        ? response.body
        : response.body.data;

      expect(orders).toBeDefined();
      for (const po of orders) {
        expect(po.branchId).toBe(branchA.id);
      }
    });

    test('limits Staff to their own branch', async () => {
      const response = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
    });

    test('rejects a Manager filtering by another branch', async () => {
      const response = await request(app)
        .get(`/api/purchase-orders?branchId=${branchB.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(403);
    });

    test('supports status filtering', async () => {
      const response = await request(app)
        .get('/api/purchase-orders?status=PENDING_APPROVAL')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    test('supports supplier filtering', async () => {
      const response = await request(app)
        .get(`/api/purchase-orders?supplierId=${supplier.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/purchase-orders/:id', () => {
    test('allows Auditor to read a PO from another branch', async () => {
      const po = await createPendingPO(managerToken);

      const response = await request(app)
        .get(`/api/purchase-orders/${po.id}`)
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(response.status).toBe(200);
    });

    test('prevents a Manager from reading another branch PO', async () => {
      const po = await createPendingPO(managerBToken);

      const response = await request(app)
        .get(`/api/purchase-orders/${po.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(403);
    });

    test('returns 404 for a nonexistent PO', async () => {
      const response = await request(app)
        .get('/api/purchase-orders/999999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/purchase-orders/:id/approve', () => {
    test('allows Admin to approve a pending PO', async () => {
      const po = await createPendingPO();

      const response = await approvePO(adminToken, po.id);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED');
    });

    test('allows a Manager to approve their own-created PO', async () => {
      const po = await createPendingPO(managerToken);

      const response = await approvePO(managerToken, po.id);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED');
    });

    test('blocks Staff from approving a PO', async () => {
      const po = await createPendingPO();

      const response = await approvePO(staffToken, po.id);

      expect(response.status).toBe(403);
    });

    test('blocks Auditor from approving a PO', async () => {
      const po = await createPendingPO();

      const response = await approvePO(auditorToken, po.id);

      expect(response.status).toBe(403);
    });

    test('returns 409 when approving an already-approved PO', async () => {
      const po = await createPendingPO();

      await approvePO(adminToken, po.id);

      const response = await approvePO(adminToken, po.id);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INVALID_STATUS');
    });

    test('blocks a Manager from approving another branch PO', async () => {
      const po = await createPendingPO(managerBToken);

      const response = await approvePO(managerToken, po.id);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/purchase-orders/:id/reject', () => {
    test('allows Admin to reject a pending PO with a reason', async () => {
      const po = await createPendingPO();

      const response = await request(app)
        .post(`/api/purchase-orders/${po.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Incorrect quantities' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
    });

    test('allows rejection without a reason', async () => {
      const po = await createPendingPO();

      const response = await request(app)
        .post(`/api/purchase-orders/${po.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
    });

    test('rejects a reason longer than 300 characters', async () => {
      const po = await createPendingPO();

      const response = await request(app)
        .post(`/api/purchase-orders/${po.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'x'.repeat(301) });

      expect(response.status).toBe(400);
    });

    test('returns 409 when rejecting a non-pending PO', async () => {
      const po = await createPendingPO();
      await approvePO(adminToken, po.id);

      const response = await request(app)
        .post(`/api/purchase-orders/${po.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INVALID_STATUS');
    });
  });

  describe('POST /api/purchase-orders/:id/receive', () => {
    test('rejects receiving before approval', async () => {
      const po = await createPendingPO();

      const response = await receivePO(managerToken, po.id);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INVALID_STATUS');
    });

    test('partially receives per-line quantities, then completes the remaining quantities', async () => {
      const created = await createPO(managerToken, {
        items: [
          { productId: product.id, quantity: 10, unitCost: 25 },
          { productId: productB.id, quantity: 5, unitCost: 15 },
        ],
      });
      expect(created.status).toBe(201);
      const po = created.body;
      await approvePO(adminToken, po.id);

      const firstReceipt = await receivePO(managerToken, po.id, {
        items: [
          { itemId: po.items[0].id, quantity: 4 },
          { itemId: po.items[1].id, quantity: 2 },
        ],
      });
      expect(firstReceipt.status).toBe(200);
      expect(firstReceipt.body.status).toBe('PARTIALLY_RECEIVED');
      expect(firstReceipt.body.items.map((item) => item.receivedQuantity)).toEqual([4, 2]);
      const partialStockA = await prisma.branchStock.findUnique({ where: { productId_branchId: { productId: product.id, branchId: branchA.id } } });
      const partialStockB = await prisma.branchStock.findUnique({ where: { productId_branchId: { productId: productB.id, branchId: branchA.id } } });
      expect(partialStockA.quantity.toNumber()).toBe(4);
      expect(partialStockB.quantity.toNumber()).toBe(2);

      const secondReceipt = await receivePO(managerToken, po.id, {
        items: [
          { itemId: po.items[0].id, quantity: 6 },
          { itemId: po.items[1].id, quantity: 3 },
        ],
      });
      expect(secondReceipt.status).toBe(200);
      expect(secondReceipt.body.status).toBe('RECEIVED');
      expect(secondReceipt.body.items.map((item) => item.receivedQuantity)).toEqual([10, 5]);
      const completedStockA = await prisma.branchStock.findUnique({ where: { productId_branchId: { productId: product.id, branchId: branchA.id } } });
      const completedStockB = await prisma.branchStock.findUnique({ where: { productId_branchId: { productId: productB.id, branchId: branchA.id } } });
      expect(completedStockA.quantity.toNumber()).toBe(10);
      expect(completedStockB.quantity.toNumber()).toBe(5);

      const movements = await prisma.stockMovement.findMany({
        where: { referenceType: 'PURCHASE_ORDER', referenceId: po.id },
        orderBy: { productId: 'asc' },
      });
      expect(movements.map((movement) => movement.quantityChange.toNumber())).toEqual([4, 6, 2, 3]);
      const audit = await prisma.auditLog.findMany({ where: { entityType: 'PO', entityId: po.id, action: 'PO_RECEIVED' }, orderBy: { id: 'asc' } });
      expect(audit).toHaveLength(2);
      expect(audit[0].newValue.status).toBe('PARTIALLY_RECEIVED');
      expect(audit[1].newValue.status).toBe('RECEIVED');
    });

    test('returns OVER_RECEIVE with itemId, remaining and requested, without changing stock', async () => {
      const po = await createPendingPO();
      await approvePO(adminToken, po.id);
      const stockBefore = await prisma.branchStock.findUnique({ where: { productId_branchId: { productId: product.id, branchId: branchA.id } } });
      const quantityBefore = stockBefore ? stockBefore.quantity.toNumber() : 0;
      const firstReceipt = await receivePO(managerToken, po.id, {
        items: [{ itemId: po.items[0].id, quantity: 4 }],
      });
      expect(firstReceipt.body.status).toBe('PARTIALLY_RECEIVED');

      const response = await receivePO(managerToken, po.id, {
        items: [{ itemId: po.items[0].id, quantity: 7 }],
      });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('OVER_RECEIVE');
      expect(response.body.error.details).toEqual([{
        field: 'items[0].quantity',
        itemId: po.items[0].id,
        remaining: 6,
        requested: 7,
      }]);
      const stock = await prisma.branchStock.findUnique({ where: { productId_branchId: { productId: product.id, branchId: branchA.id } } });
      expect(stock.quantity.toNumber()).toBe(quantityBefore + 4);
      expect(await prisma.stockMovement.count({ where: { referenceType: 'PURCHASE_ORDER', referenceId: po.id } })).toBe(1);
      expect((await prisma.purchaseOrder.findUnique({ where: { id: po.id } })).status).toBe('PARTIALLY_RECEIVED');
    });

    test('allows Staff to receive an approved PO for their branch', async () => {
      const po = await createPendingPO(managerToken);
      await approvePO(adminToken, po.id);

      const response = await receivePO(staffToken, po.id);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('RECEIVED');
    });

    test('returns 409 when receiving the same PO twice', async () => {
      const po = await createPendingPO(managerToken);
      await approvePO(adminToken, po.id);

      const firstResponse = await receivePO(managerToken, po.id);
      expect(firstResponse.status).toBe(200);

      const secondResponse = await receivePO(managerToken, po.id);

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.error.code).toBe('INVALID_STATUS');
    });

    test('blocks receiving a PO from another branch', async () => {
      const po = await createPendingPO(managerBToken);
      await approvePO(adminToken, po.id);

      const response = await receivePO(managerToken, po.id);

      expect(response.status).toBe(403);
    });

    test('blocks Auditor from receiving stock', async () => {
      const po = await createPendingPO(managerToken);
      await approvePO(adminToken, po.id);

      const response = await receivePO(auditorToken, po.id);

      expect(response.status).toBe(403);
    });
  });
});
