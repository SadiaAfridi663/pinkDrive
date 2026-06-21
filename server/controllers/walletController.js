const { Op } = require('sequelize');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Ride = require('../models/Ride');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { settleCommission } = require('../utils/commission');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.getWallet = catchAsync(async (req, res) => {
  let wallet = await Wallet.findOne({ where: { userId: req.user.id } });
  if (!wallet) {
    wallet = await Wallet.create({ userId: req.user.id, balance: 0 });
  }
  res.status(200).json({ success: true, data: { wallet } });
});

exports.topup = catchAsync(async (req, res, next) => {
  const { amount } = req.body;

  if (!amount || parseFloat(amount) <= 0) {
    return next(new AppError('Valid amount is required.', 400));
  }

  let wallet = await Wallet.findOne({ where: { userId: req.user.id } });
  if (!wallet) {
    wallet = await Wallet.create({ userId: req.user.id, balance: 0 });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    client_reference_id: req.user.id,
    customer_email: req.user.email,
    line_items: [{
      price_data: {
        currency: 'pkr',
        product_data: { name: 'PinkDrive Wallet Top-Up', description: `Add ${parseFloat(amount)} PKR to wallet` },
        unit_amount: Math.round(parseFloat(amount) * 100),
      },
      quantity: 1,
    }],
    metadata: { type: 'wallet_topup', userId: req.user.id },
    success_url: `${process.env.CLIENT_URL}/wallet?session_id={CHECKOUT_SESSION_ID}&status=success`,
    cancel_url: `${process.env.CLIENT_URL}/wallet?status=cancelled`,
  });

  wallet.pendingTopupSessionId = session.id;
  wallet.pendingTopupAmount = parseFloat(amount);
  await wallet.save();

  res.status(200).json({ success: true, data: { url: session.url } });
});

exports.confirmTopup = catchAsync(async (req, res, next) => {
  const { session_id } = req.body;
  if (!session_id) return next(new AppError('Session ID is required.', 400));

  // Prevent duplicate processing — check if this session was already confirmed
  const existing = await Transaction.findOne({
    where: { referenceId: session_id, type: 'topup' },
  });
  if (existing) {
    return res.status(200).json({ success: true, data: { alreadyProcessed: true }, message: 'Top-up already processed.' });
  }

  let wallet = await Wallet.findOne({ where: { userId: req.user.id } });
  if (!wallet) return next(new AppError('Wallet not found.', 404));

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === 'paid') {
      const amount = parseFloat(session.amount_total) / 100;
      wallet.balance = Math.round((parseFloat(wallet.balance) + amount) * 100) / 100;
      wallet.pendingTopupSessionId = null;
      wallet.pendingTopupAmount = null;
      await wallet.save();

      await Transaction.create({
        userId: req.user.id,
        type: 'topup',
        amount,
        direction: 'credit',
        description: 'Wallet top-up via Stripe',
        referenceId: session_id,
        referenceType: 'stripe_session',
        status: 'completed',
      });

      const settled = await settleCommission(wallet);
      if (settled > 0) {
        await Transaction.create({
          userId: req.user.id,
          type: 'commission_settlement',
          amount: settled,
          direction: 'debit',
          description: `Auto commission settlement (${settled} PKR)`,
          status: 'completed',
        });
        logger.info(`Auto-settled ${settled} PKR commission for user ${req.user.email} after top-up`);
      }

      logger.info(`Wallet top-up of ${amount} PKR for user ${req.user.email}`);
      return res.status(200).json({ success: true, data: { wallet }, message: 'Wallet topped up.' });
    }
    return next(new AppError('Payment not completed.', 400));
  } catch (err) {
    logger.error('Top-up confirmation error:', err.message);
    return next(new AppError('Failed to confirm payment.', 500));
  }
});

exports.getTransactions = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const { count, rows } = await Transaction.findAndCountAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: { transactions: rows, total: count, pages: Math.ceil(count / limit), currentPage: parseInt(page) },
  });
});

exports.getDriverEarnings = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const { count, rows } = await Transaction.findAndCountAll({
    where: { userId: req.user.id, type: 'ride_earnings' },
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  const totalEarnings = await Transaction.sum('amount', {
    where: { userId: req.user.id, type: 'ride_earnings', direction: 'credit' },
  }) || 0;

  res.status(200).json({
    success: true,
    data: { transactions: rows, total: parseFloat(totalEarnings), pages: Math.ceil(count / limit), currentPage: parseInt(page) },
  });
});

exports.getWithdrawableBalance = catchAsync(async (req, res) => {
  let wallet = await Wallet.findOne({ where: { userId: req.user.id } });
  if (!wallet) {
    wallet = await Wallet.create({ userId: req.user.id, balance: 0, commissionDue: 0, totalEarnings: 0, totalWithdrawn: 0 });
  }

  const pendingWithdrawals = await WithdrawalRequest.sum('amount', {
    where: { userId: req.user.id, status: 'pending' },
  }) || 0;

  const withdrawable = Math.max(0, parseFloat(wallet.balance) - parseFloat(pendingWithdrawals));

  res.status(200).json({
    success: true,
    data: {
      walletBalance: parseFloat(wallet.balance),
      commissionDue: parseFloat(wallet.commissionDue),
      totalEarnings: parseFloat(wallet.totalEarnings),
      totalWithdrawn: parseFloat(wallet.totalWithdrawn),
      pendingWithdrawals: parseFloat(pendingWithdrawals),
      withdrawable,
    },
  });
});

exports.requestWithdrawal = catchAsync(async (req, res, next) => {
  const { amount, method, accountDetails } = req.body;
  if (!amount || amount <= 0) return next(new AppError('Valid amount is required.', 400));
  if (!['bank', 'jazzcash', 'easypaisa'].includes(method)) {
    return next(new AppError('Method must be bank, jazzcash, or easypaisa.', 400));
  }
  if (!accountDetails) return next(new AppError('Account details are required.', 400));

  let wallet = await Wallet.findOne({ where: { userId: req.user.id } });
  if (!wallet) {
    wallet = await Wallet.create({ userId: req.user.id, balance: 0, commissionDue: 0, totalEarnings: 0, totalWithdrawn: 0 });
  }

  const pendingWithdrawals = await WithdrawalRequest.sum('amount', {
    where: { userId: req.user.id, status: 'pending' },
  }) || 0;

  const withdrawable = Math.max(0, parseFloat(wallet.balance) - parseFloat(pendingWithdrawals));
  if (parseFloat(amount) > withdrawable) {
    return next(new AppError(`Insufficient withdrawable balance. Available: ${withdrawable.toFixed(2)}`, 400));
  }

  const withdrawal = await WithdrawalRequest.create({
    userId: req.user.id,
    amount,
    method,
    accountDetails,
    status: 'pending',
  });

  logger.info(`Withdrawal request ${withdrawal.id} created for user ${req.user.id}: ${amount} via ${method}`);

  res.status(201).json({
    success: true,
    data: { withdrawal },
    message: 'Withdrawal request submitted. Awaiting admin approval.',
  });
});

exports.getWithdrawalHistory = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const { count, rows } = await WithdrawalRequest.findAndCountAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: { withdrawals: rows, total: count, pages: Math.ceil(count / limit), currentPage: parseInt(page) },
  });
});
