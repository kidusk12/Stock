const { AppError } = require('./errors');

// ONE builder for validation errors, used by every module (contract 1.4).
// rule is one of: required, invalid, min, max, too_short, too_long, duplicate, inactive, must_be_negative
// field is the name of the input, for example "minQuantity" or "items[0].quantity".
// issue is an English hint for developers only.
const validationError = (message, field, rule, issue) =>
  new AppError(400, 'VALIDATION_ERROR', message, [{ field, rule, issue }]);

// "items[0].quantity" style field name from a zod path
function fieldName(path) {
  if (path.length === 0) return 'body';
  return path.reduce((name, part) => {
    if (typeof part === 'number') return `${name}[${part}]`;
    return name ? `${name}.${part}` : String(part);
  }, '');
}

// Reads the value the user sent at that path (undefined when it was not sent)
function valueAt(body, path) {
  return path.reduce((obj, key) => (obj === null || obj === undefined ? undefined : obj[key]), body);
}

// Turns one zod issue into a contract rule
function ruleFor(issue, value) {
  if (value === undefined) return 'required';
  if (issue.code === 'too_small') {
    if (typeof value === 'string') return value.length === 0 ? 'required' : 'too_short';
    return 'min';
  }
  if (issue.code === 'too_big') {
    return typeof value === 'string' ? 'too_long' : 'max';
  }
  return 'invalid';
}

// Usage: router.post('/', validate(zodSchema), handler)   (validates req.body)
// On failure it sends 400 VALIDATION_ERROR with details: [{ field, rule, issue }].
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: fieldName(i.path),
      rule: ruleFor(i, valueAt(req.body, i.path)),
      issue: i.message,
    }));
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid input', details));
  }
  req.body = result.data;
  next();
};

module.exports = { validate, validationError };