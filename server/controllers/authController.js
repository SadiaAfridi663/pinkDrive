const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const DriverDocument = require('../models/DriverDocument');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const sendEmail = require('../utils/sendEmail');
const { fileToUrl } = require('../utils/geo');

const TEMP_DOC_DIR = path.join(__dirname, '..', 'uploads', 'temp-pending');

const signToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(statusCode).json({
    success: true,
    data: {
      user,
      token,
    },
  });
};

exports.register = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array().map((e) => e.msg).join('. '), 400));
  }

  const { name, email, password, gender, phone, role } = req.body;

  if (gender !== 'female') {
    return next(new AppError('Only female users can register.', 400));
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return next(new AppError('A user with this email already exists.', 400));
  }

  await PendingRegistration.destroy({ where: { email } });

  const pendingData = PendingRegistration.generate({ name, email, password, gender, role, phone });
  const pending = await PendingRegistration.create(pendingData);

  const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${pending.verificationToken}`;

  await sendEmail({
    to: email,
    subject: 'Your PinkDrive verification code',
    html: `
      <h2>Welcome to PinkDrive, ${name}!</h2>
      <p>Use the code below to verify your email:</p>
      <div style="font-size:32px;font-weight:bold;padding:16px;background:#fce4ec;border-radius:8px;text-align:center;letter-spacing:8px;">${pending.verificationCode}</div>
      <p style="color:#666;font-size:14px;">This code expires in 24 hours.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
      <p style="color:#999;font-size:13px;">Or click this link to verify: <a href="${verifyUrl}" style="color:#e91e8c;">${verifyUrl}</a></p>
    `,
  });

  logger.info(`Pending registration: ${email} (${role})`);

  res.status(201).json({
    success: true,
    verificationToken: pending.verificationToken,
    message: 'Account created! Check your email for a verification code.',
  });
});

exports.verifyEmail = catchAsync(async (req, res, next) => {
  const code = req.params.token || req.body.token;

  if (!code) {
    return next(new AppError('Verification code is required.', 400));
  }

  const pending = await PendingRegistration.findOne({
    where: {
      [Op.or]: [
        { verificationToken: code },
        { verificationCode: code },
      ],
      expiresAt: { [Op.gt]: new Date() },
    },
  });

  if (!pending) {
    return next(new AppError('Invalid or expired verification code.', 400));
  }

  if (pending.role === 'driver') {
    pending.emailVerified = true;
    await pending.save();
    logger.info(`Email verified for driver pending: ${pending.email}`);
    return res.status(200).json({
      success: true,
      message: 'Email verified! Now upload your documents to complete registration.',
      data: { emailVerified: true, role: 'driver' },
    });
  }

  const user = await User.create({
    name: pending.name,
    email: pending.email,
    password: pending.password,
    gender: pending.gender,
    role: pending.role,
    phone: pending.phone,
    isVerified: true,
  });

  const pendingDir = path.join(TEMP_DOC_DIR, pending.verificationToken);
  if (fs.existsSync(pendingDir)) {
    const files = fs.readdirSync(pendingDir);
    const docsDir = path.join(__dirname, '..', 'uploads', 'driver-docs');
    for (const file of files) {
      const src = path.join(pendingDir, file);
      const ext = path.extname(file);
      const unique = require('crypto').randomBytes(12).toString('hex');
      const dest = path.join(docsDir, `${unique}${ext}`);
      const docType = path.basename(file, ext);
      fs.copyFileSync(src, dest);
      await DriverDocument.create({
        userId: user.id,
        documentType: docType,
        filePath: fileToUrl(dest),
        originalName: file,
        mimeType: 'image/jpeg',
        status: 'pending',
      });
      fs.unlinkSync(src);
    }
    fs.rmdirSync(pendingDir);
    logger.info(`Finalized ${files.length} pending doc(s) for ${user.email}`);
  }

  await pending.destroy();

  logger.info(`Email verified, user created: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'Email verified successfully. You can now log in.',
  });
});

exports.finalizeDriver = catchAsync(async (req, res, next) => {
  const { token } = req.body;
  if (!token) {
    return next(new AppError('Verification token is required.', 400));
  }

  const pending = await PendingRegistration.findOne({
    where: {
      verificationToken: token,
      expiresAt: { [Op.gt]: new Date() },
    },
  });

  if (!pending) {
    return next(new AppError('Invalid or expired token.', 400));
  }

  if (pending.role !== 'driver') {
    return next(new AppError('Only drivers can complete registration.', 400));
  }

  if (!pending.emailVerified) {
    return next(new AppError('Please verify your email before uploading documents.', 400));
  }

  const fileValues = req.files ? Object.values(req.files).flat() : [];
  if (fileValues.length === 0) {
    return next(new AppError('At least one document is required.', 400));
  }

  const user = await User.create({
    name: pending.name,
    email: pending.email,
    password: pending.password,
    gender: pending.gender,
    role: pending.role,
    phone: pending.phone,
    isVerified: true,
  });

  const docsDir = path.join(__dirname, '..', 'uploads', 'driver-docs');
  let profilePhotoUrl = null;

  for (const file of fileValues) {
    const ext = path.extname(file.originalname);
    const unique = require('crypto').randomBytes(12).toString('hex');
    const dest = path.join(docsDir, `${unique}${ext}`);
    fs.copyFileSync(file.path, dest);

    const url = fileToUrl(dest);

    await DriverDocument.create({
      userId: user.id,
      documentType: file.fieldname,
      filePath: url,
      originalName: file.originalname,
      mimeType: file.mimetype,
      status: 'pending',
    });

    if (file.fieldname === 'profile_photo') {
      profilePhotoUrl = url;
    }

    fs.unlinkSync(file.path);
  }

  if (profilePhotoUrl) {
    await user.update({ profilePhoto: profilePhotoUrl });
  }

  const pendingDir = path.join(TEMP_DOC_DIR, token);
  if (fs.existsSync(pendingDir)) {
    const staleFiles = fs.readdirSync(pendingDir);
    for (const f of staleFiles) fs.unlinkSync(path.join(pendingDir, f));
    fs.rmdirSync(pendingDir);
  }

  await pending.destroy();

  const jwt = require('jsonwebtoken');
  const authToken = jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );

  logger.info(`Driver finalized: ${user.email}`);

  res.status(201).json({
    success: true,
    message: 'Registration complete! Documents submitted for review.',
    data: { user, token: authToken },
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array().map((e) => e.msg).join('. '), 400));
  }

  const { email, password } = req.body;

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return next(new AppError('Invalid email or password.', 401));
  }

  if (!user.isVerified) {
    return next(
      new AppError(
        'Please verify your email address before logging in. Check your inbox.',
        401,
      ),
    );
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return next(new AppError('Invalid email or password.', 401));
  }

  logger.info(`User logged in: ${user.email}`);

  sendTokenResponse(user, 200, res);
});

exports.resendVerification = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return next(new AppError('A user with this email already exists.', 404));
  }

  const pending = await PendingRegistration.findOne({ where: { email } });
  if (!pending) {
    return next(new AppError('No pending registration found with this email.', 404));
  }

  const newData = PendingRegistration.generate({
    name: pending.name,
    email: pending.email,
    password: pending.password,
    gender: pending.gender,
    role: pending.role,
    phone: pending.phone,
  });

  pending.verificationCode = newData.verificationCode;
  pending.verificationToken = newData.verificationToken;
  pending.expiresAt = newData.expiresAt;
  await pending.save();

  const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${pending.verificationToken}`;

  await sendEmail({
    to: email,
    subject: 'Your PinkDrive verification code',
    html: `
      <h2>Resend: Welcome to PinkDrive, ${pending.name}!</h2>
      <p>Use the code below to verify your email:</p>
      <div style="font-size:32px;font-weight:bold;padding:16px;background:#fce4ec;border-radius:8px;text-align:center;letter-spacing:8px;">${pending.verificationCode}</div>
      <p style="color:#666;font-size:14px;">This code expires in 24 hours.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
      <p style="color:#999;font-size:13px;">Or click this link to verify: <a href="${verifyUrl}" style="color:#e91e8c;">${verifyUrl}</a></p>
    `,
  });

  logger.info(`Verification resent: ${email}`);

  res.status(200).json({
    success: true,
    verificationToken: pending.verificationToken,
    message: 'Verification code resent. Check your email.',
  });
});

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['password', 'verificationToken', 'verificationTokenExpires'] },
  });

  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  res.status(200).json({
    success: true,
    data: { user },
  });
});

exports.uploadProfilePhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('Photo is required.', 400));

  const url = fileToUrl(req.file.path);
  req.user.profilePhoto = url;
  await req.user.save();

  logger.info(`Profile photo updated for user ${req.user.id}`);

  res.status(200).json({
    success: true,
    data: { profilePhoto: url },
    message: 'Profile photo updated.',
  });
});

exports.logout = catchAsync(async (req, res) => {
  res.cookie('token', 'none', {
    httpOnly: true,
    expires: new Date(Date.now() + 1000),
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});
