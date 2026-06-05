const nodemailer = require('nodemailer');
const { getTransporter } = require('../config/mail');
const logger = require('./logger');

const FROM = process.env.FROM_EMAIL || 'noreply@pinkdrive.com';

const sendEmail = async ({ to, subject, html }) => {
  const transporter = getTransporter();

  if (!transporter) {
    logger.info(`[DEV] Email to ${to}: ${subject}\n${html.replace(/<[^>]*>/g, '')}`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"PinkDrive" <${FROM}>`,
      to,
      subject,
      html,
    });

    logger.info(`Email sent to ${to}: ${subject}`);

    if (info.messageId) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`Ethereal preview URL: ${previewUrl}`);
      }
    }
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error.message}`);
  }
};

module.exports = sendEmail;
