const User = require('../models/User');
const Ride = require('../models/Ride');
const sendEmail = require('../utils/sendEmail');
const logger = require('../utils/logger');
const {
  rideReceipt,
  paymentConfirmation,
  refundNotification,
  disputeUpdate,
  driverRideCompleted,
} = require('../utils/emailTemplates');

const sendRideReceiptToPassenger = async (rideId) => {
  const ride = await Ride.findByPk(rideId);
  if (!ride) { logger.warn(`[Receipt] Ride ${rideId} not found`); return; }

  const [passenger, driver] = await Promise.all([
    User.findByPk(ride.passengerId),
    ride.driverId ? User.findByPk(ride.driverId) : null,
  ]);

  if (passenger?.email) {
    const html = rideReceipt(ride, passenger, driver);
    await sendEmail({
      to: passenger.email,
      subject: `Your PinkDrive Receipt — PKR ${parseFloat(ride.fare).toLocaleString()}`,
      html,
    });
    logger.info(`[Receipt] Ride receipt sent to passenger ${passenger.email} for ride ${rideId}`);
  }
};

const sendPaymentConfirmation = async (rideId) => {
  const ride = await Ride.findByPk(rideId);
  if (!ride) return;

  const passenger = await User.findByPk(ride.passengerId);
  if (passenger?.email) {
    const html = paymentConfirmation(ride, passenger, ride.fare, ride.paymentMethod);
    await sendEmail({
      to: passenger.email,
      subject: `Payment Confirmed — PKR ${parseFloat(ride.fare).toLocaleString()}`,
      html,
    });
    logger.info(`[Receipt] Payment confirmation sent to ${passenger.email} for ride ${rideId}`);
  }
};

const sendRefundNotification = async (rideId, refundAmount) => {
  const ride = await Ride.findByPk(rideId);
  if (!ride) return;

  const passenger = await User.findByPk(ride.passengerId);
  if (passenger?.email) {
    const html = refundNotification(ride, passenger, refundAmount || ride.fare);
    await sendEmail({
      to: passenger.email,
      subject: `Refund Issued — PKR ${parseFloat(refundAmount || ride.fare).toLocaleString()}`,
      html,
    });
    logger.info(`[Receipt] Refund notification sent to ${passenger.email} for ride ${rideId}`);
  }
};

const sendDisputeUpdate = async (dispute) => {
  if (!dispute.rideId) return;

  const [ride, passenger] = await Promise.all([
    Ride.findByPk(dispute.rideId),
    dispute.reportedBy ? User.findByPk(dispute.reportedBy) : null,
  ]);

  if (!ride || !passenger?.email) return;

  const html = disputeUpdate(ride, passenger, dispute);
  await sendEmail({
    to: passenger.email,
    subject: `Dispute Update — ${dispute.status.replace(/_/g, ' ')}`,
    html,
  });
  logger.info(`[Receipt] Dispute update sent to ${passenger.email} for ride ${dispute.rideId}`);
};

const sendDriverRideCompleted = async (rideId) => {
  const ride = await Ride.findByPk(rideId);
  if (!ride || !ride.driverId) return;

  const [driver, passenger] = await Promise.all([
    User.findByPk(ride.driverId),
    User.findByPk(ride.passengerId),
  ]);

  if (driver?.email) {
    const html = driverRideCompleted(ride, driver, passenger, ride.fare);
    await sendEmail({
      to: driver.email,
      subject: `Ride Completed — PKR ${parseFloat(ride.fare).toLocaleString()} earned`,
      html,
    });
    logger.info(`[Receipt] Ride completed email sent to driver ${driver.email} for ride ${rideId}`);
  }
};

module.exports = {
  sendRideReceiptToPassenger,
  sendPaymentConfirmation,
  sendRefundNotification,
  sendDisputeUpdate,
  sendDriverRideCompleted,
};
