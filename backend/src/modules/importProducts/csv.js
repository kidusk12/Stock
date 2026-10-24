const { AppError } = require('../../middleware/errors');

function parseCsv(text) {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const records = [];
  let record = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      if (value.length !== 0) throw new AppError(400, 'VALIDATION_ERROR', 'Malformed CSV quoting');
      quoted = true;
    } else if (char === ',') {
      record.push(value);
      value = '';
    } else if (char === '\n') {
      record.push(value.replace(/\r$/, ''));
      if (record.some((cell) => cell.trim() !== '')) records.push(record);
      record = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (quoted) throw new AppError(400, 'VALIDATION_ERROR', 'Malformed CSV quoting');
  if (record.length || value.length) {
    record.push(value.replace(/\r$/, ''));
    if (record.some((cell) => cell.trim() !== '')) records.push(record);
  }
  if (records.length < 2) throw new AppError(400, 'VALIDATION_ERROR', 'CSV must contain a header and at least one data row');

  const headers = records[0].map((header) => header.trim());
  const requiredHeaders = ['sku', 'name', 'barcode', 'category', 'unit', 'costPrice', 'sellingPrice', 'openingQuantity'];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new AppError(400, 'VALIDATION_ERROR', `CSV is missing required columns: ${missingHeaders.join(', ')}`, missingHeaders.map((field) => ({ field, rule: 'required', issue: 'column is required' })));
  }
  if (new Set(headers).size !== headers.length) throw new AppError(400, 'VALIDATION_ERROR', 'CSV contains duplicate column names');

  const data = records.slice(1).map((record, index) => {
    const row = {};
    headers.forEach((header, column) => { row[header] = (record[column] ?? '').trim(); });
    return { row: index + 2, data: row };
  });
  return data;
}

module.exports = { parseCsv };
