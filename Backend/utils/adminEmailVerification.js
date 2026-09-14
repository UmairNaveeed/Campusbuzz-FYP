import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { AdminCredential } from '../database/index.js';
import { ADMIN_EMAILS } from './adminConfig.js';

/**
 * Generate a secure verification token
 */
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate verification link
 */
export function generateVerificationLink(token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontendUrl}/admin/verify-email?token=${token}`;
}

/**
 * Create and store email verification token
 */
export async function createEmailVerificationToken(email) {
  const normalized = String(email || '').trim().toLowerCase();
  
  // Verify this is an admin email
  if (!ADMIN_EMAILS.includes(normalized)) {
    throw new Error('Email is not registered as an administrator');
  }

  const token = generateVerificationToken();
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Check if admin credential exists
  const existing = await AdminCredential.findOne({ email: normalized }).lean();
  
  if (!existing) {
    // Create admin credential with default password if it doesn't exist
    const { hashPassword } = await import('./adminPassword.js');
    const defaultPassword = process.env.ADMIN_PASSWORD || 'Ruba123!';
    const passwordHash = await hashPassword(defaultPassword);
    
    await AdminCredential.create({
      email: normalized,
      passwordHash,
      emailVerificationToken: token,
      emailVerificationExpires: expires,
      emailVerified: false,
    });
  } else {
    // Update existing credential
    await AdminCredential.findOneAndUpdate(
      { email: normalized },
      { 
        emailVerificationToken: token,
        emailVerificationExpires: expires,
        emailVerified: false,
        updatedAt: new Date()
      }
    );
  }

  return { token, expires };
}

/**
 * Verify email verification token
 */
export async function verifyEmailToken(token) {
  if (!token) {
    return { valid: false, error: 'Token is required' };
  }

  const admin = await AdminCredential.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: new Date() }
  }).lean();

  if (!admin) {
    return { valid: false, error: 'Invalid or expired verification link' };
  }

  // Mark email as verified
  await AdminCredential.findOneAndUpdate(
    { email: admin.email },
    { 
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      updatedAt: new Date()
    }
  );

  return { valid: true, email: admin.email };
}

/**
 * Check if admin email is verified
 */
export async function isEmailVerified(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const admin = await AdminCredential.findOne({ email: normalized }).lean();
  return admin?.emailVerified || false;
}

/**
 * Send verification email using nodemailer
 */
export async function sendVerificationEmail(email, verificationLink) {
  const normalized = String(email || '').trim().toLowerCase();
  
  // Log for development
  console.log('========================================');
  console.log('ADMIN EMAIL VERIFICATION');
  console.log('========================================');
  console.log(`To: ${normalized}`);
  console.log(`Subject: CampusBuzz Admin - Email Verification`);
  console.log(`Verification Link: ${verificationLink}`);
  console.log('========================================');
  
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️  Email credentials not configured; continuing in development mode.');
      console.warn(`⚠️  Loaded env file: ${process.env.PWD || 'unknown'}`);
      console.warn(`⚠️  EMAIL_USER: ${process.env.EMAIL_USER ? '[SET]' : '[MISSING]'}`);
      console.warn(`⚠️  EMAIL_PASS: ${process.env.EMAIL_PASS ? '[SET]' : '[MISSING]'}`);
      console.warn('⚠️  For Gmail, use an App Password: https://support.google.com/accounts/answer/185833');
      return {
        success: true,
        link: verificationLink,
        mode: 'development',
        message: 'Verification link generated locally because email delivery is not configured on this server.'
      };
    }

    const error = 'Email credentials not configured. Add EMAIL_USER and EMAIL_PASS to .env file';
    console.error(`❌ ${error}`);
    console.warn('⚠️  For Gmail, use an App Password: https://support.google.com/accounts/answer/185833');
    return { success: false, error };
  }

  try {
    const transporterConfig = process.env.EMAIL_HOST
      ? {
          host: process.env.EMAIL_HOST,
          port: Number(process.env.EMAIL_PORT || 587),
          secure: process.env.EMAIL_SECURE === 'true',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        }
      : {
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        };

    const transporter = nodemailer.createTransport(transporterConfig);
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: normalized,
      subject: 'CampusBuzz Admin - Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #193965;">Admin Email Verification</h2>
          <p>Hello,</p>
          <p>Click the button below to verify your admin email and access the CampusBuzz admin dashboard:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #193965; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666; font-size: 12px;">${verificationLink}</p>
          <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you did not request this, please ignore this email.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">CampusBuzz Admin Portal</p>
        </div>
      `,
    });
    
    console.log(`✅ Email sent successfully to ${normalized}`);
    return { success: true, link: verificationLink, mode: 'production' };
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    return { success: false, error: error.message };
  }
}

export async function sendEmail({ to, subject, text, html }) {
  const normalized = String(to || '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('Email recipient is required');
  }

  console.log(`[📧 sendEmail] Recipient: ${normalized}, Subject: ${subject}`);

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[⚠️  EMAIL CONFIG] SMTP not configured; continuing in development mode');
      console.warn(`   EMAIL_USER: ${process.env.EMAIL_USER ? '[SET]' : '[MISSING]'}`);
      console.warn(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '[SET]' : '[MISSING]'}`);
      return { success: true, mode: 'development', message: 'Email delivery is not configured; using local verification link.' };
    }

    const error = 'Email credentials not configured';
    console.warn(`[⚠️  EMAIL CONFIG] ${error}`);
    console.warn(`   EMAIL_USER: ${process.env.EMAIL_USER ? '[SET]' : '[MISSING]'}`);
    console.warn(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '[SET]' : '[MISSING]'}`);
    return { success: false, error };
  }

  try {
    console.log(`[📧 MAIL SETUP] Creating transporter for: ${process.env.EMAIL_USER}`);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    console.log(`[📧 MAIL SEND] FROM: ${process.env.EMAIL_FROM || process.env.EMAIL_USER} TO: ${normalized}`);
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: normalized,
      subject,
      text,
      html,
    });

    console.log(`✅ Email sent successfully to ${normalized}`);
    return { success: true };
  } catch (error) {
    const errorMsg = `❌ Failed to send email to ${normalized}: ${error.message}`;
    console.error(errorMsg);
    console.error(`   Error code: ${error.code}`);
    console.error(`   Details:`, error);
    return { success: false, error: error.message };
  }
}
