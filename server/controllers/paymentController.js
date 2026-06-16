const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Ride = require('../models/Ride');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { getIO } = require('../sockets');
const { sendRideReceiptToPassenger, sendDriverRideCompleted } = require('../services/receiptService');

async function confirmRidePayment(rideId, stripeSessionId) {
  const ride = await Ride.findByPk(rideId);
  if (!ride || ride.paymentStatus === 'paid') return ride;

  ride.paymentStatus = 'paid';
  if (ride.status === 'awaiting_payment') {
    ride.status = 'completed';
    ride.completedAt = new Date();
  }
  if (stripeSessionId) ride.stripeSessionId = stripeSessionId;
  await ride.save();

  logger.info(`Payment confirmed for ride ${rideId}`);

  const io = getIO();
  if (io) {
    io.to(`ride:${rideId}`).emit('ride:status', { rideId, status: ride.status });
  }

  sendRideReceiptToPassenger(rideId);
  sendDriverRideCompleted(rideId);

  return ride;
}

exports.createCheckoutSession = catchAsync(async (req, res, next) => {
  const { rideId } = req.body;

  if (!rideId) {
    return next(new AppError('Ride ID is required.', 400));
  }

  const ride = await Ride.findByPk(rideId);
  if (!ride) return next(new AppError('Ride not found.', 404));
  if (ride.passengerId !== req.user.id) return next(new AppError('Unauthorized.', 403));
  if (ride.paymentMethod !== 'stripe') return next(new AppError('Payment method is not set to stripe.', 400));
  if (ride.paymentStatus === 'paid') return next(new AppError('Ride is already paid.', 400));

  const amount = parseFloat(ride.fare);
  if (!amount || amount <= 0) {
    return next(new AppError('Invalid fare amount.', 400));
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      client_reference_id: ride.id,
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: 'pkr',
            product_data: {
              name: 'PinkDrive Ride',
              description: `Pickup: ${ride.pickupAddress || `${ride.pickupLat}, ${ride.pickupLng}`} → Dropoff: ${ride.dropoffAddress || `${ride.dropoffLat}, ${ride.dropoffLng}`}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/payment/result?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${process.env.CLIENT_URL}/payment/result?status=cancelled`,
    });

    ride.stripeSessionId = session.id;
    await ride.save();

    logger.info(`Stripe session created: ${session.id} for ride ${ride.id}`);

    res.status(200).json({
      success: true,
      data: { url: session.url, sessionId: session.id },
    });
  } catch (err) {
    logger.error('Stripe createCheckoutSession error:', err.message);
    return next(new AppError('Payment service error. Please try again.', 500));
  }
});

exports.getSessionStatus = catchAsync(async (req, res, next) => {
  const { session_id } = req.query;

  if (!session_id) {
    return next(new AppError('Session ID is required.', 400));
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.status === 'complete' && session.payment_status === 'paid') {
      const rideId = session.client_reference_id;
      if (rideId) {
        await confirmRidePayment(rideId, session.id);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        status: session.status,
        customerEmail: session.customer_details?.email,
        paymentStatus: session.payment_status,
      },
    });
  } catch (err) {
    logger.error('Stripe getSessionStatus error:', err.message);
    return next(new AppError('Invalid session ID.', 400));
  }
});

exports.getConfig = catchAsync(async (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY || '';
  const stripeConfigured = key.length > 0 && !key.includes('placeholder') && !key.includes('xxxxxxxx');
  res.status(200).json({
    success: true,
    data: { stripeConfigured },
  });
});

exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).json({ success: false, message: 'Webhook signature verification failed.' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const rideId = session.client_reference_id;

    if (rideId) {
      try {
        await confirmRidePayment(rideId, session.id);
        logger.info(`Webhook: payment completed for ride ${rideId}, stripe session ${session.id}`);
      } catch (err) {
        logger.error(`Webhook: failed to update ride ${rideId}:`, err.message);
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    const rideId = session.client_reference_id;
    if (rideId) {
      try {
        const ride = await Ride.findByPk(rideId);
        if (ride && ride.paymentStatus === 'pending') {
          ride.paymentStatus = 'failed';
          await ride.save();
          logger.info(`Payment expired/failed for ride ${rideId}`);
        }
      } catch (err) {
        logger.error(`Webhook: failed to expire ride ${rideId}:`, err.message);
      }
    }
  }

  res.status(200).json({ received: true });
};
