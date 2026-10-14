// Place this file at backend/tests/stockService.test.js
// Runs against the database in backend/.env. Every test creates its own branch, product and
// stock row (names start with "Test"/"T"), and everything is deleted again at the end.
require('dotenv').config();
const prisma = require('../src/utils/prisma');
const { applyMovement } = require('../src/services/stockService');

jest.setTimeout(30000);

const stamp = Date.now();
let counter = 0;
let user;
const branchIds = [];
const productIds = [];

async function setup({ quantity = 0, minQty = 0 } = {}) {
  counter += 1;
  const branch = await prisma.branch.create({
    data: { name: `Test Branch ${stamp}-${counter}`, code: `T${stamp}${counter}` },
  });
  const product = await prisma.product.create({
    data: { name: `Test Product ${counter}`, sku: `T-${stamp}-${counter}`, unit: 'piece', costPrice: 10, sellingPrice: 15 },
  });
  branchIds.push(branch.id);
  productIds.push(product.id);
  await prisma.branchStock.create({
    data: { productId: product.id, branchId: branch.id, quantity, minQty },
  });
  return { branchId: branch.id, productId: product.id };
}

const getStock = ({ productId, branchId }) =>
  prisma.branchStock.findUnique({ where: { productId_branchId: { productId, branchId } } });

const move = (ids, quantity, type, extra = {}) =>
  applyMovement({ ...ids, quantity, type, userId: user.id, ...extra });

beforeAll(async () => {
  user = await prisma.user.create({
    data: { username: `test-stock-${stamp}`, passwordHash: 'x', fullName: 'Stock Test', role: 'STAFF' },
  });
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.branchStock.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
});

test('adds stock and writes a movement record', async () => {
  const ids = await setup();
  const result = await move(ids, 10, 'PURCHASE_RECEIPT', { referenceType: 'PURCHASE_ORDER', referenceId: 1 });

  expect(result.quantityBefore).toBe(0);
  expect(result.quantityAfter).toBe(10);
  expect((await getStock(ids)).quantity.toNumber()).toBe(10);

  const movement = await prisma.stockMovement.findUnique({ where: { id: result.movementId } });
  expect(movement.type).toBe('PURCHASE_RECEIPT');
  expect(movement.quantityChange.toNumber()).toBe(10);
  expect(movement.quantityAfter.toNumber()).toBe(10);
  expect(movement.userId).toBe(user.id);
});

test('removes stock', async () => {
  const ids = await setup({ quantity: 5 });
  const result = await move(ids, -2, 'SALE');
  expect(result.quantityAfter).toBe(3);
  expect((await getStock(ids)).quantity.toNumber()).toBe(3);
});

test('rejects a change that would make stock negative, and changes nothing', async () => {
  const ids = await setup({ quantity: 1 });
  await expect(move(ids, -2, 'SALE')).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', status: 422 });

  expect((await getStock(ids)).quantity.toNumber()).toBe(1);
  expect(await prisma.stockMovement.count({ where: { productId: ids.productId } })).toBe(0);
});

test('rejects a quantity whose sign does not match the type', async () => {
  const ids = await setup({ quantity: 5 });
  await expect(move(ids, 3, 'SALE')).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
  await expect(move(ids, -3, 'PURCHASE_RECEIPT')).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
  await expect(move(ids, 0, 'ADJUSTMENT')).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
  await expect(move(ids, 1.234, 'ADJUSTMENT')).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
  expect((await getStock(ids)).quantity.toNumber()).toBe(5);
});

test('handles two decimals exactly', async () => {
  const ids = await setup();
  await move(ids, 9.12, 'PURCHASE_RECEIPT');
  const result = await move(ids, -0.12, 'ADJUSTMENT', { reason: 'DAMAGE' });
  expect(result.quantityAfter).toBe(9);
});

test('creates one low-stock alert, not repeated, and re-arms after restock', async () => {
  const ids = await setup({ quantity: 10, minQty: 5 });
  const notifications = () => prisma.notification.count({ where: { productId: ids.productId } });

  const first = await move(ids, -6, 'SALE'); // 10 -> 4, at or below the minimum
  expect(first.lowStockAlert).toBe(true);
  expect(await notifications()).toBe(1);

  const second = await move(ids, -1, 'SALE'); // 4 -> 3, still low: no new alert
  expect(second.lowStockAlert).toBe(false);
  expect(await notifications()).toBe(1);

  await move(ids, 10, 'PURCHASE_RECEIPT'); // 3 -> 13, back above the minimum: re-armed
  expect((await getStock(ids)).lowStockAlerted).toBe(false);

  const third = await move(ids, -9, 'SALE'); // 13 -> 4, low again: new alert
  expect(third.lowStockAlert).toBe(true);
  expect(await notifications()).toBe(2);
});

test('no alert when no minimum is set', async () => {
  const ids = await setup({ quantity: 3, minQty: 0 });
  const result = await move(ids, -3, 'SALE');
  expect(result.lowStockAlert).toBe(false);
  expect(await prisma.notification.count({ where: { productId: ids.productId } })).toBe(0);
});

test('two simultaneous sales of the last unit: one succeeds, one is rejected', async () => {
  const ids = await setup({ quantity: 1 });
  const results = await Promise.allSettled([move(ids, -1, 'SALE'), move(ids, -1, 'SALE')]);

  const ok = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');
  expect(ok).toHaveLength(1);
  expect(failed).toHaveLength(1);
  expect(failed[0].reason.code).toBe('INSUFFICIENT_STOCK');
  expect((await getStock(ids)).quantity.toNumber()).toBe(0);
  expect(await prisma.stockMovement.count({ where: { productId: ids.productId } })).toBe(1);
});

test('rolls back when the caller transaction fails afterwards', async () => {
  const ids = await setup();
  await expect(
    prisma.$transaction(async (tx) => {
      await applyMovement({ ...ids, quantity: 5, type: 'PURCHASE_RECEIPT', userId: user.id }, tx);
      throw new Error('boom');
    })
  ).rejects.toThrow('boom');

  expect((await getStock(ids)).quantity.toNumber()).toBe(0);
  expect(await prisma.stockMovement.count({ where: { productId: ids.productId } })).toBe(0);
});

test('creates the stock row when it is missing, and rejects unknown products', async () => {
  const { productId, branchId } = await setup();
  await prisma.branchStock.delete({ where: { productId_branchId: { productId, branchId } } });

  const result = await move({ productId, branchId }, 4, 'OPENING_STOCK');
  expect(result.quantityAfter).toBe(4);

  await expect(move({ productId: 99999999, branchId }, 1, 'OPENING_STOCK')).rejects.toMatchObject({ code: 'NOT_FOUND' });
});