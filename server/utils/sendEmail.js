const nodemailer = require('nodemailer');
const { getTransporter } = require('../config/mail');
const logger = require('./logger');

const FROM = process.env.SMTP_USER || process.env.FROM_EMAIL || 'noreply@pinkdrive.com';

const sendEmail = async ({ to, subject, html }) => {
  const plainText = html.replace(/<[^>]*>/g, '').trim();
  logger.info(`[EMAIL] To: ${to} | Subject: ${subject}`);
  logger.info(`[EMAIL] Body: ${plainText}`);

  const transporter = getTransporter();

  if (!transporter) {
    logger.info('[EMAIL] No transporter — email logged to console only.');
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
        console.log('');
        console.log('╔══════════════════════════════════════════════════════╗');
        console.log('║        📧  PREVIEW YOUR EMAIL (Ethereal)          ║');
        console.log('╚══════════════════════════════════════════════════════╝');
        console.log(`  ${previewUrl}`);
        console.log('');
      }
    }
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error.message}`);
  }
};

module.exports = sendEmail;
