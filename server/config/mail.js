const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter = null;

const createTransporter = async () => {
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    logger.info('SMTP transporter configured');
    return;
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info(`Ethereal email enabled — preview at https://ethereal.email/login (user=${testAccount.user})`);
  } catch {
    logger.warn('No SMTP configured and Ethereal unavailable — emails logged to console only.');
    transporter = null;
  }
};

const getTransporter = () => transporter;

module.exports = { createTransporter, getTransporter };
