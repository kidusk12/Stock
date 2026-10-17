// backend/src/utils/sort.js
const { validationError } = require('../middleware/validate');

/**
 * Build a Prisma orderBy from a query.sort string.
 * "?sort=name"  -> ascending
 * "?sort=-name" -> descending
 * Unknown field  -> 400 VALIDATION_ERROR (rule: invalid, field: sort)
 * Always appends `id` as a stable secondary sort key.
 */
function parseSort(querySort, allowedFields, defaultOrder = [{ name: 'asc' }]) {
  if (!querySort) {
    return withStableId(defaultOrder, allowedFields);
  }

  const raw = String(querySort);
  const isDesc = raw.startsWith('-');
  const field = isDesc ? raw.slice(1) : raw;

  if (!allowedFields.includes(field)) {
    throw validationError(
      `Invalid sort field: ${field}`,
      'sort',
      'invalid',
      'UNKNOWN_SORT_FIELD'
    );
  }

  return withStableId([{ [field]: isDesc ? 'desc' : 'asc' }], allowedFields);
}

function withStableId(orderBy, allowedFields) {
  const alreadyHasId = orderBy.some((o) => Object.keys(o).includes('id'));
  if (!alreadyHasId && allowedFields.includes('id')) {
    return [...orderBy, { id: 'asc' }];
  }
  return orderBy;
}

module.exports = { parseSort };