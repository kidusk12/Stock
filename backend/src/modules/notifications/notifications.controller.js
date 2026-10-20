const { asyncHandler } = require('../../middleware/errors');
const notificationsService = require('./notifications.service');

const list = asyncHandler(async (req, res) => {
  const result = await notificationsService.listNotifications(
    req.user,
    req.query
  );

  res.json(result);
});

const markRead = asyncHandler(async (req, res) => {
  const result = await notificationsService.markNotificationRead(
    req.user,
    req.params.id
  );

  res.json(result);
});

const markAllRead = asyncHandler(async (req, res) => {
  const result =
    await notificationsService.markAllNotificationsRead(req.user);

  res.json(result);
});

const listLowStock = asyncHandler(async (req, res) => {
  const result = await notificationsService.listLowStock(
    req.user,
    req.query
  );

  res.json(result);
});

module.exports = {
  list,
  markRead,
  markAllRead,
  listLowStock,
};