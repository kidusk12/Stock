// backend/src/modules/suppliers/suppliers.service.js
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { parsePagination } = require('../../utils/pagination');
const { parseSort } = require('../../utils/sort');

const SORT_FIELDS = ['name', 'id'];

const mapSupplier = (r) => ({
  id: r.id,
  name: r.name,
  contactName: r.contactName,
  phone: r.phone,
  tin: r.tin,
  address: r.address,
  isActive: r.isActive,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

function parseIdOr404(id) {
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
  }
  return id;
}

async function listSuppliers(query) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 100 });
  const includeInactive = query.includeInactive === 'true';
  const orderBy = parseSort(query.sort, SORT_FIELDS, [{ name: 'asc' }]);

  const where = {};
  if (!includeInactive) where.isActive = true;
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { tin: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({ where, orderBy, skip, take: limit }),
  ]);

  return { data: rows.map(mapSupplier), page, limit, total };
}

async function getSupplier(id) {
  parseIdOr404(id);
  const row = await prisma.supplier.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
  return mapSupplier(row);
}

// G3: supplier names are NOT unique in the database — do not catch P2002 on name
async function createSupplier(data, actingUserId) {
  const row = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({ data });
    await tx.auditLog.create({ data: { userId: actingUserId, action: 'SUPPLIER_CREATED', entityType: 'SUPPLIER', entityId: supplier.id,
      newValue: { name: supplier.name, tin: supplier.tin } } });
    return supplier;
  });
  return mapSupplier(row);
}

async function updateSupplier(id, data, actingUserId) {
  parseIdOr404(id);
  const before = await prisma.supplier.findUnique({ where: { id } });
  if (!before) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.supplier.update({ where: { id }, data });
    await tx.auditLog.create({ data: { userId: actingUserId, action: 'SUPPLIER_UPDATED', entityType: 'SUPPLIER', entityId: id,
      oldValue: { name: before.name, contactName: before.contactName, phone: before.phone, tin: before.tin, address: before.address, isActive: before.isActive },
      newValue: { name: updated.name, contactName: updated.contactName, phone: updated.phone, tin: updated.tin, address: updated.address, isActive: updated.isActive } } });
    return updated;
  });
  return mapSupplier(row);
}

module.exports = { listSuppliers, getSupplier, createSupplier, updateSupplier };
