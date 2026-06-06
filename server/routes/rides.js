const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createRide,
  uploadSelfie,
  getActiveRide,
  getPendingRides,
  acceptRide,
  updateRideStatus,
  cancelRide,
  getRideHistory,
  getRideById,
  updateDriverLocation,
  getNearbyDrivers,
  uploadTempSelfie,
} = require('../controllers/rideController');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  authorize('passenger'),
  [
    body('pickupLat').isFloat().withMessage('Pickup latitude required.'),
    body('pickupLng').isFloat().withMessage('Pickup longitude required.'),
    body('dropoffLat').isFloat().withMessage('Drop-off latitude required.'),
    body('dropoffLng').isFloat().withMessage('Drop-off longitude required.'),
    body('paymentMethod').optional().isIn(['cash', 'stripe', 'card']).withMessage('Payment method must be cash, stripe, or card.'),
  ],
  createRide,
);

router.post(
  '/selfie/upload',
  authorize('passenger'),
  upload.single('selfie'),
  uploadTempSelfie,
);

router.post(
  '/:id/selfie',
  authorize('passenger'),
  upload.single('selfie'),
  uploadSelfie,
);

router.get('/active', getActiveRide);

router.get('/pending', authorize('driver'), getPendingRides);

router.patch('/:id/accept', authorize('driver'), acceptRide);

router.patch(
  '/:id/status',
  authorize('driver'),
  [body('status').isString()],
  updateRideStatus,
);

router.patch('/:id/cancel', authorize('passenger'), cancelRide);

router.get('/history', getRideHistory);

router.get('/nearby-drivers', getNearbyDrivers);

router.get('/:id', getRideById);

router.patch(
  '/:id/driver-location',
  authorize('driver'),
  [body('lat').isFloat(), body('lng').isFloat()],
  updateDriverLocation,
);

module.exports = router;
