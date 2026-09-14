import { verifyAdminPassword } from '../utils/adminPassword.js';
import { ADMIN_EMAILS } from '../utils/adminConfig.js';
import { 
  createEmailVerificationToken, 
  sendVerificationEmail,
  isEmailVerified,
  verifyEmailToken as verifyEmailTokenUtil
} from '../utils/adminEmailVerification.js';
import admin from 'firebase-admin';

/**
 * POST /api/admin/login-request
 * Request login - validates credentials and sends verification email
 */
export const requestAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Verify this is an admin email
    if (!ADMIN_EMAILS.includes(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        error: 'This email is not registered as an administrator.',
      });
    }

    // Verify password
    const valid = await verifyAdminPassword(normalizedEmail, password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password for admin account.',
      });
    }

    // Create verification token
    const { token, expires } = await createEmailVerificationToken(normalizedEmail);
    
    // Generate verification link
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/verify-email?token=${token}`;
    
    // Send verification email
    const emailResult = await sendVerificationEmail(normalizedEmail, verificationLink);
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again later.',
      });
    }

    return res.json({
      success: true,
      message: emailResult.message || 'Verification email sent. Please check your email to continue.',
      verificationLink: emailResult.mode === 'development' || process.env.NODE_ENV === 'development' ? verificationLink : undefined,
      mode: emailResult.mode,
    });
  } catch (err) {
    console.error('requestAdminLogin error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Login request failed' 
    });
  }
};

/**
 * POST /api/admin/verify-email-token
 * Verify email token and generate Firebase custom token for sign-in
 */
export const verifyEmailToken = async (req, res) => {
  try {
    const { token } = req.body || {};
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Verification token is required' 
      });
    }

    const result = await verifyEmailTokenUtil(token);
    
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Invalid or expired verification link',
      });
    }

    // Generate Firebase custom token for this admin
    const customToken = await admin.auth().createCustomToken(result.email, {
      adminEmail: result.email,
      isAdmin: true,
    });

    return res.json({
      success: true,
      email: result.email,
      customToken,
      message: 'Email verified successfully. You can now access the dashboard.',
    });
  } catch (err) {
    console.error('verifyEmailToken error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Verification failed' 
    });
  }
};

/**
 * POST /api/admin/check-email-verified
 * Check if admin email is verified (for frontend to show PIN setup if needed)
 */
export const checkEmailVerified = async (req, res) => {
  try {
    const email = req.admin?.email;
    
    if (!email) {
      return res.status(401).json({ 
        success: false, 
        error: 'Admin session required' 
      });
    }

    const verified = await isEmailVerified(email);
    
    return res.json({
      success: true,
      emailVerified: verified,
    });
  } catch (err) {
    console.error('checkEmailVerified error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to check email verification status' 
    });
  }
};
