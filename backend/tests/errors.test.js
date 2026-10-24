// Error handler: the contract 1.4 shape, and client mistakes must never be a 500.
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');
const { AppError, errorHandler } = require('../src/middleware/errors');

// A minimal response object, so the handler can be tested without a database
function run(err) {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  errorHandler(err, {}, res, () => {});
  return res;
}

afterAll(async () => {
  await prisma.$disconnect();
});

test('an AppError keeps its status, code, message and details', () => {
  const plain = run(new AppError(404, 'NOT_FOUND', 'Product not found'));
  expect(plain.statusCode).toBe(404);
  expect(plain.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Product not found' } });

  const details = [{ field: 'quantity', productId: 1, available: 0, requested: 1 }];
  const withDetails = run(new AppError(422, 'INSUFFICIENT_STOCK', 'Not enough stock for 1 item.', details));
  expect(withDetails.statusCode).toBe(422);
  expect(withDetails.body.error.details).toEqual(details);
});

test('body-parser errors are 4xx: invalid JSON is 400, too large is 413', () => {
  const bad = run(Object.assign(new Error('bad json'), { type: 'entity.parse.failed', status: 400 }));
  expect(bad.statusCode).toBe(400);
  expect(bad.body.error.code).toBe('VALIDATION_ERROR');

  const big = run(Object.assign(new Error('too large'), { type: 'entity.too.large', status: 413, expose: true }));
  expect(big.statusCode).toBe(413);
  expect(big.body.error.code).toBe('VALIDATION_ERROR');

  const charset = run(Object.assign(new Error('bad charset'), { type: 'charset.unsupported', status: 415, expose: true }));
  expect(charset.statusCode).toBe(415);
});

test('a number that is out of range for the database is 400', () => {
  const prismaError = Object.assign(new Error('Value out of range for the type'), {
    name: 'PrismaClientKnownRequestError',
    code: 'P2020',
  });
  const a = run(prismaError);
  expect(a.statusCode).toBe(400);
  expect(a.body.error.code).toBe('VALIDATION_ERROR');

  const b = run(new Error('Unable to fit integer value 99999999999999999999 into an INT4'));
  expect(b.statusCode).toBe(400);
});

test('text with a null byte is 400', () => {
  const res = run(new Error('invalid byte sequence for encoding "UTF8": 0x00'));
  expect(res.statusCode).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
});

test('an unknown error is still a 500 and is logged, without details', () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = run(new Error('database password is hunter2'));
  expect(res.statusCode).toBe(500);
  expect(res.body).toEqual({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});

test('a body over 100 KB is 413 through the real app', async () => {
  const res = await request(app)
    .post('/api/does-not-exist')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ text: 'a'.repeat(200000) }));
  expect(res.status).toBe(413);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
});