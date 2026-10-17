// backend/src/modules/branches/branches.service.js
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { parsePagination } = require('../../utils/pagination');
const { parseSort } = require('../../utils/sort');
const { createStockRowsForBranch } = require('../../services/stockService');

const SORT_FIELDS = ['name', 'code', 'id'];

const mapBranch = (r) => ({
  id: r.id,
  name: r.name,
  code: r.code,
  address: r.address,
  phone: r.phone,
  isActive: r.isActive,
});

function parseIdOr404(id) {
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(404, 'NOT_FOUND', 'Branch not found');
  }
  return id;
}

async function listBranches(query) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 100 });
  const includeInactive = query.includeInactive === 'true';
  const orderBy = parseSort(query.sort, SORT_FIELDS, [{ name: 'asc' }]);

  const where = {};
  if (!includeInactive) where.isActive = true;
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { code: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.branch.count({ where }),
    prisma.branch.findMany({ where, orderBy, skip, take: limit }),
  ]);

  return { data: rows.map(mapBranch), page, limit, total };
}

async function getBranch(id) {
  parseIdOr404(id);
  const row = await prisma.branch.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Branch not found');
  return mapBranch(row);
}

async function createBranch(data) {
  try {
    const created = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({ data });
      await createStockRowsForBranch(branch.id, tx);
      return branch;
    });
    return mapBranch(created);
  } catch (e) {
    if (e.code === 'P2002') {
      const target = [].concat(e.meta?.target ?? []);
      if (target.includes('code')) {
        throw new AppError(409, 'DUPLICATE_VALUE', 'Branch code already used');
      }
      if (target.includes('name')) {
        throw new AppError(409, 'DUPLICATE_VALUE', 'Branch name already used');
      }
      throw new AppError(409, 'DUPLICATE_VALUE', 'Branch name or code already used');
    }
    throw e;
  }
}

async function updateBranch(id, data) {
  parseIdOr404(id);
  await getBranch(id);
  try {
    const row = await prisma.branch.update({ where: { id }, data });
    return mapBranch(row);
  } catch (e) {
    if (e.code === 'P2002') {
      throw new AppError(409, 'DUPLICATE_VALUE', 'Branch name or code already used');
    }
    throw e;
  }
}

module.exports = { listBranches, getBranch, createBranch, updateBranch };