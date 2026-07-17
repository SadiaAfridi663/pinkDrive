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
  leaveTrip,
  removePassenger,
  retractRequest,
  getRestoreState,
  updateTripStatus,
  driverArriving,
  boardPassenger,
  dropoffPassenger,
  getAcceptedPassengers,
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
router.get('/restore-state', getRestoreState);

router.post(
  '/:tripId/request',
  authorize('passenger'),
  [
    body('pickupLat').isFloat().withMessage('Pickup latitude required.'),
    body('pickupLng').isFloat().withMessage('Pickup longitude required.'),
    body('dropoffLat').isFloat().withMessage('Dropoff latitude required.'),
    body('dropoffLng').isFloat().withMessage('Dropoff longitude required.'),
    handleValidation,
  ],
  requestJoin,
);

router.get('/:tripId/requests', authorize('driver'), getTripRequests);

router.patch('/:tripId/cancel', authorize('driver'), cancelTrip);
router.patch('/:tripId/leave', authorize('passenger'), leaveTrip);
router.patch('/:tripId/retract-request', authorize('passenger'), retractRequest);
router.patch('/:tripId/remove-passenger/:passengerId', authorize('driver'), removePassenger);

router.patch('/:tripId/status', authorize('driver'), updateTripStatus);
router.patch('/:tripId/driver-arriving', authorize('driver'), driverArriving);
router.patch('/:tripId/passenger-board/:requestId', authorize('driver'), boardPassenger);
router.patch('/:tripId/passenger-drop/:requestId', authorize('driver'), dropoffPassenger);
router.get('/:tripId/accepted-passengers', authorize('driver'), getAcceptedPassengers);

const requestRouter = express.Router();
requestRouter.patch('/:requestId/accept', authorize('driver'), acceptRequest);
requestRouter.patch('/:requestId/decline', authorize('driver'), declineRequest);

router.use('/requests', requestRouter);

module.exports = router;
