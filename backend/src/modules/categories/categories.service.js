// backend/src/modules/categories/categories.service.js
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { parsePagination } = require('../../utils/pagination');
const { parseSort } = require('../../utils/sort');

const SORT_FIELDS = ['name', 'id'];
const mapCategory = (r) => ({ id: r.id, name: r.name, isActive: r.isActive });

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
  const row = await prisma.category.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Category not found');
  return mapCategory(row);
}

async function createCategory(body) {
  try {
    const row = await prisma.category.create({ data: { name: body.name } });
    return mapCategory(row);
  } catch (e) {
    if (e.code === 'P2002') {
      throw new AppError(409, 'DUPLICATE_VALUE', 'Category name already exists');
    }
    throw e;
  }
}

async function updateCategory(id, body) {
  await getCategory(id);
  try {
    const row = await prisma.category.update({ where: { id }, data: body });
    return mapCategory(row);
  } catch (e) {
    if (e.code === 'P2002') {
      throw new AppError(409, 'DUPLICATE_VALUE', 'Category name already exists');
    }
    throw e;
  }
}

module.exports = { listCategories, getCategory, createCategory, updateCategory };