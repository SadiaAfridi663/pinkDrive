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
  acceptOffer,
  updateRideStatus,
  confirmPayment,
  acknowledgePayment,
  reportIssue,
  cancelRide,
  getRideHistory,
  getRideById,
  updateDriverLocation,
  getNearbyDrivers,
  uploadTempSelfie,
  getRideBids,
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
    body('paymentMethod').optional().isIn(['cash', 'stripe', 'card', 'easypaisa', 'jazzcash', 'wallet']).withMessage('Payment method must be cash, stripe, card, easypaisa, jazzcash, or wallet.'),
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

router.post('/accept-offer', authorize('passenger'), acceptOffer);

router.patch(
  '/:id/status',
  authorize('driver'),
  [body('status').isString()],
  updateRideStatus,
);

router.patch('/:id/cancel', authorize('passenger'), cancelRide);

router.post('/:id/confirm-payment', authorize('driver'), confirmPayment);
router.post('/:id/acknowledge-payment', authorize('passenger'), acknowledgePayment);
router.post('/:id/report-issue', reportIssue);

router.get('/history', getRideHistory);

router.get('/nearby-drivers', getNearbyDrivers);

router.get('/:id/bids', getRideBids);

router.get('/:id', getRideById);

router.patch(
  '/:id/driver-location',
  authorize('driver'),
  [body('lat').isFloat(), body('lng').isFloat()],
  updateDriverLocation,
);

module.exports = router;
