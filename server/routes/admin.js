const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.use(authenticate);
router.use(authorize('admin'));

router.get('/stats', adminController.getStats);
router.get('/payments', adminController.getPaymentStats);
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id/suspend', adminController.suspendUser);
router.patch('/users/:id/restriction', adminController.updateUserRestriction);
router.get('/rides', adminController.getAllRides);
router.get('/rides/:id', adminController.getRideById);
router.patch('/rides/:id/payment-status', adminController.overridePaymentStatus);
router.get('/activities', adminController.getActivities);
router.get('/disputes', adminController.getDisputes);
router.get('/disputes/:id', adminController.getDisputeById);
router.patch('/disputes/:id/resolve', adminController.resolveDispute);
router.post('/debts/:id/clear', adminController.clearDebt);
router.get('/withdrawals', adminController.getWithdrawals);
router.patch('/withdrawals/:id', adminController.processWithdrawal);
router.get('/wallets', adminController.getDriverWallets);
router.get('/wallets/:id', adminController.getDriverWalletByUserId);
router.post('/wallets/:id/settle-commission', adminController.settleCommissionManually);
router.post('/wallets/:id/adjust', adminController.adjustWalletBalance);

module.exports = router;
