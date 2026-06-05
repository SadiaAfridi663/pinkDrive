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
  ],
  createRide,
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

module.exports = router;
