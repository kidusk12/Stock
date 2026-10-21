const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { D } = require('../../utils/decimal');

// K-H: the default rates have no stored place yet, so they are defined here. Read only.
const DEFAULT_TAX_RATES = Object.freeze({ VAT: 15, TOT: 2 });

// The settings object from the contract (6.1). Field map (6.11): taxRate is a fraction in the
// database and a percentage in the API. nextInvoiceNumber is never exposed.
function toSettings(row) {
  return {
    companyName: row.companyName,
    address: row.address,
    phone: row.phone,
    tin: row.tin,
    taxType: row.taxType,
    taxRate: row.taxRate.mul(100).toNumber(),
    defaultTaxRates: { ...DEFAULT_TAX_RATES },
    updatedAt: row.updatedAt,
  };
}

// GET /api/settings/company   (Admin only)
async function getSettings() {
  const row = await prisma.companySetting.findUnique({ where: { id: 1 } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Company settings not found');
  return toSettings(row);
}

// PUT /api/settings/company   (Admin only)
// PUT replaces the editable fields: address, phone and tin that are left out become null.
// nextInvoiceNumber is never changed here. Old invoices keep their own taxType and taxRate.
async function updateSettings(body) {
  const data = {
    companyName: body.companyName,
    address: body.address || null,
    phone: body.phone || null,
    tin: body.tin || null,
    taxType: body.taxType,
    taxRate: D(body.taxRate).div(100),
  };

  const row = await prisma.companySetting.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  return toSettings(row);
}

module.exports = { getSettings, updateSettings, DEFAULT_TAX_RATES };
