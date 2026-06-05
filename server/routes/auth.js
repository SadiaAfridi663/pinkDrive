const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.'),
    body('gender').equals('female').withMessage('Only female users can register.'),
  ],
  authController.register,
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  authController.login,
);

router.get('/verify/:token', authController.verifyEmail);

router.post(
  '/verify',
  [body('token').notEmpty().withMessage('Verification token is required.')],
  authController.verifyEmail,
);

router.post(
  '/resend-verification',
  [body('email').isEmail().withMessage('Valid email is required.')],
  authController.resendVerification,
);

router.get('/me', authenticate, authController.getMe);

router.post('/logout', authenticate, authController.logout);

module.exports = router;
