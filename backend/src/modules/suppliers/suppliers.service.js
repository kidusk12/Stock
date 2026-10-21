// backend/src/modules/suppliers/suppliers.service.js
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { parsePagination } = require('../../utils/pagination');
const { parseSort } = require('../../utils/sort');
const { parseIdOr404 } = require('../../utils/params');

const SORT_FIELDS = ['name', 'id'];

const mapSupplier = (r) => ({
  id: r.id,
  name: r.name,
  contactName: r.contactName,
  phone: r.phone,
  tin: r.tin,
  address: r.address,
  isActive: r.isActive,
});

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
  parseIdOr404(id, 'Supplier not found');
  const row = await prisma.supplier.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
  return mapSupplier(row);
}

// G3: supplier names are NOT unique in the database — do not catch P2002 on name
async function createSupplier(data) {
  const row = await prisma.supplier.create({ data });
  return mapSupplier(row);
}

async function updateSupplier(id, data) {
  parseIdOr404(id, 'Supplier not found');
  await getSupplier(id);
  const row = await prisma.supplier.update({ where: { id }, data });
  return mapSupplier(row);
}

module.exports = { listSuppliers, getSupplier, createSupplier, updateSupplier };
