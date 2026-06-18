const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const walletController = require('../controllers/walletController');

router.use(authenticate);

router.get('/', walletController.getWallet);
router.post('/topup', walletController.topup);
router.post('/confirm-topup', walletController.confirmTopup);
router.get('/transactions', walletController.getTransactions);
router.get('/driver-earnings', authorize('driver'), walletController.getDriverEarnings);

router.get('/withdrawable', authorize('driver'), walletController.getWithdrawableBalance);
router.post('/withdraw', authorize('driver'), walletController.requestWithdrawal);
router.get('/withdrawals', authorize('driver'), walletController.getWithdrawalHistory);

module.exports = router;
