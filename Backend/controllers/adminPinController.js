import { setAdminPin, verifyAdminPin, hasAdminPin, validatePinFormat, generatePinResetCode, verifyPinResetCode, clearPinResetCode } from '../utils/adminPin.js';
import { isAdminEmail, ADMIN_EMAILS } from '../utils/adminConfig.js';
import { sendEmail } from '../utils/adminEmailVerification.js';

/**
 * POST /api/admin/pin/setup
 * Set up admin PIN (first time setup)
 */
export const setupAdminPin = async (req, res) => {
  try {
    const email = req.admin?.email;
    
    if (!email) {
      return res.status(401).json({ 
        success: false, 
        error: 'Admin session required' 
      });
    }

    const { pin, confirmPin } = req.body || {};

    if (!pin || !confirmPin) {
      return res.status(400).json({
        success: false,
        error: 'PIN and confirmation are required.',
      });
    }

    if (pin !== confirmPin) {
      return res.status(400).json({
        success: false,
        error: 'PIN and confirmation do not match.',
      });
    }

    const validation = validatePinFormat(pin);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    // Check if PIN is already set
    const pinExists = await hasAdminPin(email);
    if (pinExists) {
      return res.status(400).json({
        success: false,
        error: 'PIN is already set. Use the change PIN endpoint instead.',
      });
    }

    await setAdminPin(email, pin);

    return res.json({
      success: true,
      message: 'PIN set successfully.',
    });
  } catch (err) {
    console.error('setupAdminPin error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to set PIN' 
    });
  }
};

/**
 * POST /api/admin/pin/verify
 * Verify admin PIN
 */
export const verifyAdminPinEndpoint = async (req, res) => {
  try {
    const email = req.admin?.email;
    
    if (!email) {
      return res.status(401).json({ 
        success: false, 
        error: 'Admin session required' 
      });
    }

    const { pin } = req.body || {};

    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'PIN is required.',
      });
    }

    const validation = validatePinFormat(pin);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    const valid = await verifyAdminPin(email, pin);
    
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect PIN.',
      });
    }

    return res.json({
      success: true,
      message: 'PIN verified successfully.',
    });
  } catch (err) {
    console.error('verifyAdminPinEndpoint error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to verify PIN' 
    });
  }
};

/**
 * POST /api/admin/pin/change
 * Change admin PIN (once set, only admin emails can reset)
 */
export const changeAdminPin = async (req, res) => {
  try {
    const email = req.admin?.email;
    
    if (!email) {
      return res.status(401).json({ 
        success: false, 
        error: 'Admin session required' 
      });
    }

    const { oldPin, newPin, confirmPin } = req.body || {};

    if (!oldPin || !newPin || !confirmPin) {
      return res.status(400).json({
        success: false,
        error: 'Old PIN, new PIN, and confirmation are required.',
      });
    }

    if (newPin !== confirmPin) {
      return res.status(400).json({
        success: false,
        error: 'New PIN and confirmation do not match.',
      });
    }

    if (oldPin === newPin) {
      return res.status(400).json({
        success: false,
        error: 'New PIN must be different from the old PIN.',
      });
    }

    const validation = validatePinFormat(newPin);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    // Check if PIN is already set
    const pinIsSet = await hasAdminPin(email);
    
    // If PIN is already set, only allow admin emails to reset it
    if (pinIsSet && !isAdminEmail(email)) {
      return res.status(403).json({
        success: false,
        error: `PIN can only be reset by admin email accounts: ${ADMIN_EMAILS.join(', ')}`,
      });
    }

    // Verify old PIN
    const oldPinValid = await verifyAdminPin(email, oldPin);
    if (!oldPinValid) {
      return res.status(401).json({
        success: false,
        error: 'Old PIN is incorrect.',
      });
    }

    await setAdminPin(email, newPin);

    return res.json({
      success: true,
      message: 'PIN changed successfully.',
    });
  } catch (err) {
    console.error('changeAdminPin error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to change PIN' 
    });
  }
};

/**
 * GET /api/admin/pin/status
 * Check if admin has set up PIN
 */
export const getPinStatus = async (req, res) => {
  try {
    const email = req.admin?.email;
    
    if (!email) {
      return res.status(401).json({ 
        success: false, 
        error: 'Admin session required' 
      });
    }

    const hasPin = await hasAdminPin(email);

    return res.json({
      success: true,
      hasPin,
    });
  } catch (err) {
    console.error('getPinStatus error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to check PIN status' 
    });
  }
};

/**
 * POST /api/admin/pin/request-reset
 * Request PIN reset code (sent to admin email)
 */
export const requestPinReset = async (req, res) => {
  try {
    const email = req.admin?.email;
    
    if (!email) {
      return res.status(401).json({ 
        success: false, 
        error: 'Admin session required' 
      });
    }

    // Only admin emails can request PIN reset
    if (!isAdminEmail(email)) {
      return res.status(403).json({
        success: false,
        error: `PIN reset is restricted to admin email accounts: ${ADMIN_EMAILS.join(', ')}`,
      });
    }

    // Check if PIN is set
    const pinExists = await hasAdminPin(email);
    if (!pinExists) {
      return res.status(400).json({
        success: false,
        error: 'No PIN has been set yet. Use setup endpoint instead.',
      });
    }

    // Generate reset code
    const resetCode = await generatePinResetCode(email);
    console.log('[PIN RESET] requestPinReset', {
      email,
      generatedResetCode: resetCode,
    });
    
    // Send email with reset code
    const isDev = process.env.NODE_ENV === 'development';
    const resetCodeDisplay = isDev ? ` Dev Code: ${resetCode}` : '';
    
    const emailResult = await sendEmail({
      to: email,
      subject: 'CampusBuzz Admin PIN Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #193965;">PIN Reset Request</h2>
          <p>Hello,</p>
          <p>You requested to reset your CampusBuzz admin PIN. Use the code below to complete the reset:</p>
          <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
            <p style="font-size: 12px; color: #666; margin: 0 0 10px 0;">Verification Code</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #193965; margin: 0; font-family: monospace;">${resetCode}</p>
          </div>
          <p style="color: #666; font-size: 14px;"><strong>Important:</strong> This code expires in 10 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you did not request this, please ignore this email and contact your administrator.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">CampusBuzz Admin Portal</p>
        </div>
      `
    });

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to send reset email.'
      });
    }

    return res.json({
      success: true,
      message: `Reset code sent to ${email}. Code expires in 10 minutes.`,
      devResetCode: isDev ? resetCode : undefined,
    });
  } catch (err) {
    console.error('requestPinReset error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to request PIN reset' 
    });
  }
};

/**
 * POST /api/admin/pin/reset-with-code
 * Reset PIN using reset code
 */
export const resetPinWithCode = async (req, res) => {
  try {
    const email = req.admin?.email;
    
    if (!email) {
      return res.status(401).json({ 
        success: false, 
        error: 'Admin session required' 
      });
    }

    const rawBody = req.body || {};
    const resetCode = String(rawBody.resetCode || '').trim().toUpperCase();
    const newPin = String(rawBody.newPin || '').trim();
    const confirmPin = String(rawBody.confirmPin || '').trim();

    console.log('[PIN RESET] resetPinWithCode request body', {
      email,
      resetCode,
      newPinProvided: !!newPin,
      confirmPinProvided: !!confirmPin,
    });

    if (!resetCode || !newPin || !confirmPin) {
      return res.status(400).json({
        success: false,
        error: 'Reset code, new PIN, and confirmation are required.',
      });
    }

    if (resetCode.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Reset code must be 6 characters.',
      });
    }

    if (newPin !== confirmPin) {
      return res.status(400).json({
        success: false,
        error: 'New PIN and confirmation do not match.',
      });
    }

    const validation = validatePinFormat(newPin);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    // Verify reset code
    const codeValid = await verifyPinResetCode(email, resetCode);
    if (!codeValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset code.',
      });
    }

    // Set new PIN
    await setAdminPin(email, newPin);
    
    // Clear reset code
    await clearPinResetCode(email);

    return res.json({
      success: true,
      message: 'PIN reset successfully.',
    });
  } catch (err) {
    console.error('resetPinWithCode error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to reset PIN' 
    });
  }
};
