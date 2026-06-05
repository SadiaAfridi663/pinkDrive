const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  uploadDocuments,
  getVerificationStatus,
  getPendingVerifications,
  reviewVerification,
  deleteRejectedDocument,
} = require('../controllers/driverVerificationController');

const router = express.Router();

router.use(authenticate);

router.post(
  '/upload',
  authorize('driver'),
  upload.fields([
    { name: 'license', maxCount: 1 },
    { name: 'registration', maxCount: 1 },
    { name: 'profile_photo', maxCount: 1 },
  ]),
  uploadDocuments,
);

router.get('/status', authorize('driver'), getVerificationStatus);

router.get('/pending', authorize('admin'), getPendingVerifications);

router.patch(
  '/review/:userId',
  authorize('admin'),
  [
    body('action').isIn(['approved', 'rejected']).withMessage('Action must be "approved" or "rejected".'),
    body('adminNote').optional().trim().isString(),
  ],
  reviewVerification,
);

router.delete(
  '/documents/:documentId',
  authorize('driver'),
  deleteRejectedDocument,
);

module.exports = router;
