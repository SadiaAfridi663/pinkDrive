const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const {
  createTrip,
  getAvailableTrips,
  getMyTrips,
  getMyRequests,
  requestJoin,
  getTripRequests,
  acceptRequest,
  declineRequest,
  cancelTrip,
} = require('../controllers/sharedTripController');

const router = express.Router();

router.use(authenticate);

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array().map((e) => e.msg).join('; '),
    });
  }
  next();
};

router.post(
  '/',
  authorize('driver'),
  [
    body('pickupLat').isFloat().withMessage('Pickup latitude required.'),
    body('pickupLng').isFloat().withMessage('Pickup longitude required.'),
    body('dropoffLat').isFloat().withMessage('Dropoff latitude required.'),
    body('dropoffLng').isFloat().withMessage('Dropoff longitude required.'),
    body('departureTime').isISO8601().withMessage('Valid departure time required.'),
    body('availableSeats').isInt({ min: 1 }).withMessage('At least 1 seat required.'),
    body('pricePerSeat').isFloat({ min: 1 }).withMessage('Price per seat required.'),
    handleValidation,
  ],
  createTrip,
);

router.get('/available', authorize('passenger'), getAvailableTrips);

router.get('/my', authorize('driver'), getMyTrips);

router.get('/requests/my', getMyRequests);

router.post(
  '/:tripId/request',
  authorize('passenger'),
  [
    body('pickupLat').isFloat().withMessage('Pickup latitude required.'),
    body('pickupLng').isFloat().withMessage('Pickup longitude required.'),
    body('dropoffLat').isFloat().withMessage('Dropoff latitude required.'),
    body('dropoffLng').isFloat().withMessage('Dropoff longitude required.'),
  ],
  requestJoin,
);

router.get('/:tripId/requests', authorize('driver'), getTripRequests);

router.patch('/:tripId/cancel', authorize('driver'), cancelTrip);

const requestRouter = express.Router();
requestRouter.patch('/:requestId/accept', authorize('driver'), acceptRequest);
requestRouter.patch('/:requestId/decline', authorize('driver'), declineRequest);

router.use('/requests', requestRouter);

module.exports = router;
