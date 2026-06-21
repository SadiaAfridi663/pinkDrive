const COMMISSION_PERCENTAGE = parseFloat(process.env.COMMISSION_PERCENTAGE || 10);
const MAX_COMMISSION_DEBT = parseFloat(process.env.MAX_COMMISSION_DEBT || 500);

function calculateCommission(fare) {
  const platformFee = Math.round((fare * COMMISSION_PERCENTAGE) / 100 * 100) / 100;
  const driverEarning = Math.round((fare - platformFee) * 100) / 100;
  return { platformFee, driverEarning };
}

async function settleCommission(wallet, { transaction } = {}) {
  if (wallet.balance > 0 && wallet.commissionDue > 0) {
    const settlement = Math.min(
      parseFloat(wallet.balance),
      parseFloat(wallet.commissionDue),
    );
    wallet.balance = Math.round((parseFloat(wallet.balance) - settlement) * 100) / 100;
    wallet.commissionDue = Math.round((parseFloat(wallet.commissionDue) - settlement) * 100) / 100;
    await wallet.save({ transaction });
    return settlement;
  }
  return 0;
}

function isDebtLocked(wallet) {
  return parseFloat(wallet.commissionDue) >= MAX_COMMISSION_DEBT;
}

async function debitDriverWallet(driverWallet, amount, options = {}) {
  const { transaction, type, rideId, description } = options;
  const Transaction = require('../models/Transaction');
  driverWallet.balance = Math.round((parseFloat(driverWallet.balance) - amount) * 100) / 100;
  await driverWallet.save({ transaction });
  return Transaction.create({
    userId: driverWallet.userId,
    type: type || 'adjustment',
    amount,
    direction: 'debit',
    description: description || null,
    rideId: rideId || null,
  }, { transaction });
}

async function creditDriverWallet(driverWallet, amount, options = {}) {
  const { transaction, type, rideId, description } = options;
  const Transaction = require('../models/Transaction');
  driverWallet.balance = Math.round((parseFloat(driverWallet.balance) + amount) * 100) / 100;
  await driverWallet.save({ transaction });
  return Transaction.create({
    userId: driverWallet.userId,
    type: type || 'adjustment',
    amount,
    direction: 'credit',
    description: description || null,
    rideId: rideId || null,
  }, { transaction });
}

module.exports = {
  COMMISSION_PERCENTAGE,
  MAX_COMMISSION_DEBT,
  calculateCommission,
  settleCommission,
  isDebtLocked,
  debitDriverWallet,
  creditDriverWallet,
};