const { asyncHandler } = require('../../middleware/errors');
const settingsService = require('./settings.service');

// Contract 6.1: both endpoints return the settings object directly (no { data } wrapper).

const get = asyncHandler(async (req, res) => {
  res.json(await settingsService.getSettings());
});

const update = asyncHandler(async (req, res) => {
  res.json(await settingsService.updateSettings(req.body));
});

module.exports = { get, update };