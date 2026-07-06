const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const {
  createReview,
  getDriverReviews,
  getMyReviews,
  getMyRatings,
} = require('../controllers/reviewController');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  [
    body('reviewedId').notEmpty().withMessage('Reviewed user ID required.'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5.'),
  ],
  createReview,
);

router.get('/driver/:driverId', getDriverReviews);

router.get('/my', getMyReviews);

router.get('/my-ratings', getMyRatings);

module.exports = router;
