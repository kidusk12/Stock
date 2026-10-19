// backend/src/modules/categories/categories.service.js
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { parsePagination } = require('../../utils/pagination');
const { parseSort } = require('../../utils/sort');

const SORT_FIELDS = ['name', 'id'];
const mapCategory = (r) => ({ id: r.id, name: r.name, isActive: r.isActive, createdAt: r.createdAt, updatedAt: r.updatedAt });

// A bad id in the URL (abc, 0, negative, NaN) is a 404, not a 500.
function parseIdOr404(id) {
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(404, 'NOT_FOUND', 'Category not found');
  }
  return id;
}

async function listCategories(query) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 100 });
  const includeInactive = query.includeInactive === 'true';
  const orderBy = parseSort(query.sort, SORT_FIELDS, [{ name: 'asc' }]);

  const where = {};
  if (!includeInactive) where.isActive = true;
  if (query.q) where.name = { contains: query.q, mode: 'insensitive' };

  const [total, rows] = await prisma.$transaction([
    prisma.category.count({ where }),
    prisma.category.findMany({ where, orderBy, skip, take: limit }),
  ]);

  return { data: rows.map(mapCategory), page, limit, total };
}

async function getCategory(id) {
  parseIdOr404(id);
  const row = await prisma.category.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Category not found');
  return mapCategory(row);
}

async function createCategory(body, actingUserId) {
  try {
    const row = await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({ data: { name: body.name } });
      await tx.auditLog.create({ data: { userId: actingUserId, action: 'CATEGORY_CREATED', entityType: 'CATEGORY', entityId: category.id,
        newValue: { name: category.name } } });
      return category;
    });
    return mapCategory(row);
  } catch (e) {
    if (e.code === 'P2002') {
      throw new AppError(409, 'DUPLICATE_VALUE', 'Category name already exists');
    }
    throw e;
  }
}

async function updateCategory(id, body, actingUserId) {
  parseIdOr404(id);
  const before = await getCategory(id);
  try {
    const row = await prisma.$transaction(async (tx) => {
      const category = await tx.category.update({ where: { id }, data: body });
      await tx.auditLog.create({ data: { userId: actingUserId, action: 'CATEGORY_UPDATED', entityType: 'CATEGORY', entityId: id,
        oldValue: { name: before.name, isActive: before.isActive }, newValue: { name: category.name, isActive: category.isActive } } });
      return category;
    });
    return mapCategory(row);
  } catch (e) {
    if (e.code === 'P2002') {
      throw new AppError(409, 'DUPLICATE_VALUE', 'Category name already exists');
    }
    throw e;
  }
}

module.exports = { listCategories, getCategory, createCategory, updateCategory };
