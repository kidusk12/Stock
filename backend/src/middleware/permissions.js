const AppError = require('../utils/AppError');

// Manager and Staff are locked to their own branchId.
// If the request specifies another branch, 403.
const branchScope = (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Not authenticated'));

  const { role, branchId: userBranchId } = req.user;
  if (role === 'ADMIN' || role === 'AUDITOR') return next();

  const requested = req.query.branchId || req.body.branchId || req.params.branchId;
  if (requested !== undefined && Number(requested) !== userBranchId) {
    return next(new AppError(403, 'FORBIDDEN', 'Cannot access another branch'));
  }

  req.branchId = userBranchId;
  next();
};

module.exports = { branchScope };