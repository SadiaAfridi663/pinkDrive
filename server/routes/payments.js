const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many payment attempts. Please try again later.' },
});

router.post('/create-checkout-session', authenticate, checkoutLimiter, paymentController.createCheckoutSession);
router.get('/session-status', authenticate, paymentController.getSessionStatus);

module.exports = router;
