const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter = null;

const createTransporter = async () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;

  if (host && user && pass) {
    const smtpTransporter = nodemailer.createTransport({
      host,
      port,
      auth: { user, pass },
    });

    try {
      await smtpTransporter.verify();
      transporter = smtpTransporter;
      logger.info('SMTP transporter configured and verified');
      return;
    } catch (err) {
      logger.warn(`SMTP verification failed: ${err.message}.`);
    }
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
    logger.warn('No email transporter available — codes logged to console only.');
    transporter = null;
  }
};

const getTransporter = () => transporter;

module.exports = { createTransporter, getTransporter };
