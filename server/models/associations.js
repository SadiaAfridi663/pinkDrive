const User = require('./User');
const Ride = require('./Ride');
const SharedTrip = require('./SharedTrip');
const TripRequest = require('./TripRequest');
const Wallet = require('./Wallet');
const Transaction = require('./Transaction');
const Notification = require('./Notification');
const Review = require('./Review');
const SOSAlert = require('./SOSAlert');
const EmergencyContact = require('./EmergencyContact');
const DriverDocument = require('./DriverDocument');
const PendingRegistration = require('./PendingRegistration');
const Debt = require('./Debt');
const Dispute = require('./Dispute');
const WithdrawalRequest = require('./WithdrawalRequest');
const Bid = require('./Bid');

function setupAssociations() {
  // TripRequest <-> SharedTrip
  TripRequest.belongsTo(SharedTrip, { foreignKey: 'tripId', as: 'trip' });
  SharedTrip.hasMany(TripRequest, { foreignKey: 'tripId' });

  // Wallet <-> User
  Wallet.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasOne(Wallet, { foreignKey: 'userId' });

  // Ride <-> User
  Ride.belongsTo(User, { foreignKey: 'passengerId', as: 'passenger' });
  Ride.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });
  User.hasMany(Ride, { foreignKey: 'passengerId', as: 'passengerRides' });
  User.hasMany(Ride, { foreignKey: 'driverId', as: 'driverRides' });

  // SharedTrip <-> User
  SharedTrip.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });
  User.hasMany(SharedTrip, { foreignKey: 'driverId', as: 'sharedTrips' });

  // TripRequest <-> User
  TripRequest.belongsTo(User, { foreignKey: 'passengerId', as: 'passenger' });
  User.hasMany(TripRequest, { foreignKey: 'passengerId', as: 'tripRequests' });

  // Notification <-> User
  Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(Notification, { foreignKey: 'userId' });

  // Review <-> User
  Review.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Review.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });
  User.hasMany(Review, { foreignKey: 'userId' });
  User.hasMany(Review, { foreignKey: 'driverId', as: 'driverReviews' });

  // SOSAlert <-> User
  SOSAlert.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(SOSAlert, { foreignKey: 'userId' });

  // EmergencyContact <-> User
  EmergencyContact.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(EmergencyContact, { foreignKey: 'userId' });

  // Transaction <-> User
  Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(Transaction, { foreignKey: 'userId' });

  // WithdrawalRequest <-> User
  WithdrawalRequest.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(WithdrawalRequest, { foreignKey: 'userId' });

  // Debt <-> User
  Debt.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(Debt, { foreignKey: 'userId' });

  // Dispute <-> User
  Dispute.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(Dispute, { foreignKey: 'userId' });

  // Bid <-> User
  Bid.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(Bid, { foreignKey: 'userId' });

  // Bid <-> Ride
  Bid.belongsTo(Ride, { foreignKey: 'rideId', as: 'ride' });
  Ride.hasMany(Bid, { foreignKey: 'rideId' });

  // DriverDocument <-> User
  DriverDocument.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(DriverDocument, { foreignKey: 'userId' });
}

module.exports = setupAssociations;
