const { AppError } = require('./errors');

// Usage: router.post('/', validate(zodSchema), handler)   (validates req.body)
// On failure it sends 400 VALIDATION_ERROR with details: [{ field, issue }] (contract 1.4).
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      issue: i.message,
    }));
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid input', details));
  }
  req.body = result.data;
  next();
};

module.exports = { validate };