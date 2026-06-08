const ServiceArea = require('../models/ServiceArea');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

exports.getAll = catchAsync(async (req, res, next) => {
  const areas = await ServiceArea.findAll({
    order: [['createdAt', 'DESC']],
  });
  res.status(200).json({ success: true, data: { areas } });
});

exports.getActive = catchAsync(async (req, res, next) => {
  const areas = await ServiceArea.findAll({
    where: { isActive: true },
    order: [['createdAt', 'DESC']],
  });
  res.status(200).json({ success: true, data: { areas } });
});

exports.create = catchAsync(async (req, res, next) => {
  const { name, coordinates, color } = req.body;
  if (!name || !coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
    return next(new AppError('Name and at least 3 coordinate pairs are required.', 400));
  }
  const area = await ServiceArea.create({
    name,
    coordinates,
    color: color || '#e91e8c',
  });
  logger.info(`Service area created: ${area.name} (${area.id})`);
  res.status(201).json({
    success: true,
    data: { area },
    message: `Service area "${area.name}" created.`,
  });
});

exports.update = catchAsync(async (req, res, next) => {
  const area = await ServiceArea.findByPk(req.params.id);
  if (!area) return next(new AppError('Service area not found.', 404));
  const { name, coordinates, color, isActive } = req.body;
  if (coordinates && (!Array.isArray(coordinates) || coordinates.length < 3)) {
    return next(new AppError('At least 3 coordinate pairs are required.', 400));
  }
  if (name !== undefined) area.name = name;
  if (coordinates !== undefined) area.coordinates = coordinates;
  if (color !== undefined) area.color = color;
  if (isActive !== undefined) area.isActive = isActive;
  await area.save();
  logger.info(`Service area updated: ${area.name} (${area.id})`);
  res.status(200).json({
    success: true,
    data: { area },
    message: `Service area "${area.name}" updated.`,
  });
});

exports.remove = catchAsync(async (req, res, next) => {
  const area = await ServiceArea.findByPk(req.params.id);
  if (!area) return next(new AppError('Service area not found.', 404));
  await area.destroy();
  logger.info(`Service area deleted: ${area.name} (${area.id})`);
  res.status(200).json({
    success: true,
    message: `Service area "${area.name}" deleted.`,
  });
});
