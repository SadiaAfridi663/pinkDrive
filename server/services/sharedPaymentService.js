const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const logger = require('../utils/logger');
const { calculateCommission } = require('../utils/commission');
const { sequelize } = require('../config/db.sql');

/**
 * Hold payment for a passenger's accepted request.
 * - wallet: deduct from passenger balance
 * - stripe: create PaymentIntent with manual capture
 */
async function holdPayment(tripRequest, trip) {
  const { paymentMethod } = trip;
  if (paymentMethod === 'cash') return;

  const amount = parseFloat(trip.pricePerSeat);
  if (!amount || amount <= 0) return;

  const passengerId = tripRequest.passengerId;

  if (paymentMethod === 'wallet') {
    await holdWalletPayment(passengerId, tripRequest.id, trip.id, amount);
  } else if (paymentMethod === 'stripe') {
    await holdStripePayment(tripRequest, amount);
  }
}

/**
 * Capture held payment on dropoff.
 * - wallet: credit driver wallet
 * - stripe: capture the PaymentIntent
 */
async function capturePayment(tripRequest, trip) {
  const { paymentMethod } = trip;
  if (paymentMethod === 'cash') return;

  const amount = parseFloat(trip.pricePerSeat);
  if (!amount || amount <= 0) return;

  if (paymentMethod === 'wallet') {
    await captureWalletPayment(tripRequest, trip, amount);
  } else if (paymentMethod === 'stripe') {
    await captureStripePayment(tripRequest, amount);
  }
}

/**
 * Release/refund held payment on cancel or decline.
 */
async function releasePayment(tripRequest, trip) {
  const { paymentMethod } = trip;
  if (paymentMethod === 'cash') return;

  const amount = parseFloat(trip.pricePerSeat);
  if (!amount || amount <= 0) return;

  if (paymentMethod === 'wallet') {
    await releaseWalletPayment(tripRequest, amount);
  } else if (paymentMethod === 'stripe') {
    await releaseStripePayment(tripRequest);
  }
}

// ─── Wallet Payment ──────────────────────────────────────

async function holdWalletPayment(passengerId, requestId, tripId, amount) {
  const t = await sequelize.transaction();
  try {
    const wallet = await Wallet.findOne({ where: { userId: passengerId }, transaction: t });
    if (!wallet || parseFloat(wallet.balance) < amount) {
      await t.rollback();
      logger.warn(`holdWalletPayment: insufficient balance for user ${passengerId}`);
      return;
    }

    wallet.balance = Math.round((parseFloat(wallet.balance) - amount) * 100) / 100;
    await wallet.save({ transaction: t });

    await Transaction.create({
      userId: passengerId,
      type: 'ride_payment',
      amount,
      direction: 'debit',
      description: `Shared trip seat hold (${tripId.slice(0, 8)}...)`,
      referenceId: tripId,
      referenceType: 'shared_trip',
      tripRequestId: requestId,
      status: 'pending',
    }, { transaction: t });

    await t.commit();
    logger.info(`Wallet hold ${amount} for shared trip ${tripId}, passenger ${passengerId}`);
  } catch (err) {
    await t.rollback();
    logger.error(`holdWalletPayment failed: ${err.message}`);
  }
}

async function captureWalletPayment(tripRequest, trip, amount) {
  const t = await sequelize.transaction();
  try {
    // Mark passenger's transaction as completed
    await Transaction.update(
      { status: 'completed' },
      { where: { tripRequestId: tripRequest.id, type: 'ride_payment', direction: 'debit' }, transaction: t },
    );

    // Credit driver wallet
    const { platformFee, driverEarning } = calculateCommission(amount);
    let driverWallet = await Wallet.findOne({ where: { userId: trip.driverId }, transaction: t });
    if (!driverWallet) {
      driverWallet = await Wallet.create({
        userId: trip.driverId, balance: 0, commissionDue: 0, totalEarnings: 0, totalWithdrawn: 0,
      }, { transaction: t });
    }
    driverWallet.balance = Math.round((parseFloat(driverWallet.balance) + driverEarning) * 100) / 100;
    driverWallet.totalEarnings = Math.round((parseFloat(driverWallet.totalEarnings) + driverEarning) * 100) / 100;
    await driverWallet.save({ transaction: t });

    await Transaction.create({
      userId: trip.driverId,
      type: 'ride_earnings',
      amount: driverEarning,
      direction: 'credit',
      description: `Shared trip earnings (${trip.id.slice(0, 8)}...)`,
      referenceId: trip.id,
      referenceType: 'shared_trip',
      tripRequestId: tripRequest.id,
      status: 'completed',
    }, { transaction: t });

    await tripRequest.update({ isPaid: true, paymentStatus: 'paid' }, { transaction: t });
    await t.commit();
    logger.info(`Wallet capture ${driverEarning} for shared trip ${trip.id}, driver ${trip.driverId}`);
  } catch (err) {
    await t.rollback();
    logger.error(`captureWalletPayment failed: ${err.message}`);
  }
}

async function releaseWalletPayment(tripRequest, amount) {
  const t = await sequelize.transaction();
  try {
    const existing = await Transaction.findOne({
      where: { tripRequestId: tripRequest.id, type: 'ride_payment', direction: 'debit', status: 'pending' },
      transaction: t,
    });
    if (!existing) { await t.rollback(); return; }

    // Refund passenger
    const wallet = await Wallet.findOne({ where: { userId: tripRequest.passengerId }, transaction: t });
    if (wallet) {
      wallet.balance = Math.round((parseFloat(wallet.balance) + amount) * 100) / 100;
      await wallet.save({ transaction: t });
    }

    await existing.update({ status: 'failed' }, { transaction: t });

    await Transaction.create({
      userId: tripRequest.passengerId,
      type: 'refund',
      amount,
      direction: 'credit',
      description: `Shared trip refund (${tripRequest.tripId?.slice(0, 8)}...)`,
      referenceId: tripRequest.tripId,
      referenceType: 'shared_trip',
      tripRequestId: tripRequest.id,
      status: 'completed',
    }, { transaction: t });

    await tripRequest.update({ isPaid: false, paymentStatus: 'refunded' }, { transaction: t });
    await t.commit();
    logger.info(`Wallet refund ${amount} for shared trip request ${tripRequest.id}`);
  } catch (err) {
    await t.rollback();
    logger.error(`releaseWalletPayment failed: ${err.message}`);
  }
}

// ─── Stripe Payment ──────────────────────────────────────

async function holdStripePayment(tripRequest, amount) {
  try {
    const passenger = await User.findByPk(tripRequest.passengerId);
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'pkr',
      capture_method: 'manual',
      metadata: {
        tripRequestId: tripRequest.id,
        tripId: tripRequest.tripId,
        passengerId: tripRequest.passengerId,
        type: 'shared_trip',
      },
      description: `Shared trip seat - ${tripRequest.tripId?.slice(0, 8)}...`,
    });

    await tripRequest.update({
      stripePaymentIntentId: intent.id,
      paymentStatus: 'pending',
    });

    logger.info(`Stripe PaymentIntent created: ${intent.id} for request ${tripRequest.id}`);
    return intent.client_secret;
  } catch (err) {
    logger.error(`holdStripePayment failed: ${err.message}`);
  }
}

async function captureStripePayment(tripRequest, amount) {
  const piId = tripRequest.stripePaymentIntentId;
  if (!piId) return;

  try {
    const intent = await stripe.paymentIntents.capture(piId);
    if (intent.status === 'succeeded') {
      await tripRequest.update({ isPaid: true, paymentStatus: 'paid' });

      const passenger = await User.findByPk(tripRequest.passengerId);
      const { platformFee, driverEarning } = calculateCommission(amount);
      const driverWallet = await Wallet.findOne({ where: { userId: tripRequest.trip?.driverId } });
      if (driverWallet) {
        driverWallet.balance = Math.round((parseFloat(driverWallet.balance) + driverEarning) * 100) / 100;
        driverWallet.totalEarnings = Math.round((parseFloat(driverWallet.totalEarnings) + driverEarning) * 100) / 100;
        await driverWallet.save();
      }

      logger.info(`Stripe capture succeeded: ${piId} for request ${tripRequest.id}`);
    }
  } catch (err) {
    logger.error(`captureStripePayment failed for ${piId}: ${err.message}`);
  }
}

async function releaseStripePayment(tripRequest) {
  const piId = tripRequest.stripePaymentIntentId;
  if (!piId) return;

  try {
    await stripe.paymentIntents.cancel(piId);
    await tripRequest.update({ isPaid: false, paymentStatus: 'refunded' });
    logger.info(`Stripe PaymentIntent cancelled: ${piId} for request ${tripRequest.id}`);
  } catch (err) {
    logger.error(`releaseStripePayment failed for ${piId}: ${err.message}`);
  }
}

module.exports = { holdPayment, capturePayment, releasePayment };
