const { Op } = require('sequelize');
const User = require('../models/User');
const DriverDocument = require('../models/DriverDocument');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { fileToUrl } = require('../utils/geo');

exports.uploadDocuments = catchAsync(async (req, res, next) => {
  const driver = await User.findByPk(req.user.id);
  if (!driver || driver.role !== 'driver') {
    return next(new AppError('Only drivers can upload verification documents.', 403));
  }

  const fileValues = req.files ? Object.values(req.files).flat() : [];
  if (fileValues.length === 0) {
    return next(new AppError('At least one document is required.', 400));
  }

  const docs = [];
  for (const file of fileValues) {
    const doc = await DriverDocument.create({
      userId: req.user.id,
      documentType: file.fieldname,
      filePath: fileToUrl(file.path),
      originalName: file.originalname,
      mimeType: file.mimetype,
      status: 'pending',
    });
    docs.push(doc);
  }

  logger.info(`Driver ${req.user.email} uploaded ${docs.length} document(s)`);

  res.status(201).json({
    success: true,
    data: { documents: docs },
    message: 'Documents uploaded successfully. Awaiting admin review.',
  });
});

exports.getVerificationStatus = catchAsync(async (req, res, next) => {
  const driver = await User.findByPk(req.user.id);
  if (!driver) {
    return next(new AppError('User not found.', 404));
  }

  const documents = await DriverDocument.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
  });

  const allApproved = documents.length > 0 && documents.every((d) => d.status === 'approved');
  const hasRejected = documents.some((d) => d.status === 'rejected');
  const hasPending = documents.some((d) => d.status === 'pending');
  let status = 'not_submitted';
  if (documents.length > 0) {
    if (allApproved) status = 'approved';
    else if (hasRejected && !hasPending) status = 'rejected';
    else status = 'pending';
  }

  res.status(200).json({
    success: true,
    data: {
      status,
      isDriverVerified: driver.isDriverVerified,
      documents: documents.map((d) => {
      const json = d.toJSON();
      json.filePath = fileToUrl(json.filePath);
      return json;
    }),
    },
  });
});

exports.getPendingVerifications = catchAsync(async (req, res, next) => {
  const drivers = await User.findAll({
    where: { role: 'driver', isDriverVerified: false },
    attributes: ['id', 'name', 'email', 'phone', 'createdAt'],
  });

  const driversWithDocs = await Promise.all(
    drivers.map(async (driver) => {
      const documents = await DriverDocument.findAll({
        where: { userId: driver.id },
        order: [['createdAt', 'DESC']],
      });
      return {
        ...driver.toJSON(),
        documents: documents.map((d) => {
          const json = d.toJSON();
          json.filePath = fileToUrl(json.filePath);
          return json;
        }),
      };
    }),
  );

  const pending = driversWithDocs.filter((d) => d.documents.some((doc) => doc.status === 'pending'));

  res.status(200).json({
    success: true,
    data: { drivers: pending },
  });
});

exports.reviewVerification = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { action, adminNote } = req.body;

  if (!['approved', 'rejected'].includes(action)) {
    return next(new AppError('Action must be "approved" or "rejected".', 400));
  }

  const driver = await User.findByPk(userId);
  if (!driver || driver.role !== 'driver') {
    return next(new AppError('Driver not found.', 404));
  }

  const documents = await DriverDocument.findAll({
    where: { userId, status: 'pending' },
  });

  if (documents.length === 0) {
    return next(new AppError('No pending documents for this driver.', 400));
  }

  await Promise.all(
    documents.map((doc) =>
      doc.update({
        status: action,
        adminNote: adminNote || null,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      }),
    ),
  );

  if (action === 'approved') {
    const allDocs = await DriverDocument.findAll({ where: { userId } });
    const allApproved = allDocs.every((d) => d.status === 'approved');
    if (allApproved) {
      const profileDoc = allDocs.find((d) => d.documentType === 'profile_photo' && d.status === 'approved');
      await driver.update({
        isDriverVerified: true,
        profilePhoto: profileDoc ? fileToUrl(profileDoc.filePath) : driver.profilePhoto,
      });
      logger.info(`Driver verified: ${driver.email}`);
    }
  }

  logger.info(`Admin ${req.user.email} ${action} verification for ${driver.email}`);

  res.status(200).json({
    success: true,
    message: `Driver verification ${action} successfully.`,
  });
});

exports.deleteRejectedDocument = catchAsync(async (req, res, next) => {
  const { documentId } = req.params;

  const doc = await DriverDocument.findByPk(documentId);
  if (!doc) {
    return next(new AppError('Document not found.', 404));
  }

  if (doc.userId !== req.user.id) {
    return next(new AppError('Unauthorized.', 403));
  }

  if (doc.status !== 'rejected') {
    return next(new AppError('Only rejected documents can be deleted.', 400));
  }

  try {
    fs.unlinkSync(doc.filePath);
  } catch {
    // file may not exist
  }

  await doc.destroy();

  const driver = await User.findByPk(req.user.id);
  if (driver.isDriverVerified) {
    const remaining = await DriverDocument.findAll({ where: { userId: req.user.id } });
    if (remaining.length === 0 || remaining.some((d) => d.status !== 'approved')) {
      await driver.update({ isDriverVerified: false });
    }
  }

  logger.info(`Driver ${req.user.email} removed rejected document ${documentId}`);

  res.status(200).json({
    success: true,
    message: 'Rejected document removed.',
  });
});
