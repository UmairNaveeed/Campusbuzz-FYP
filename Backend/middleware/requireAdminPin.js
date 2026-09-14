import { verifyAdminPin } from '../utils/adminPin.js';

/**
 * Middleware to require admin PIN verification for sensitive actions
 * Expects PIN in request body: { pin: '123456' }
 */
export async function requireAdminPin(req, res, next) {
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
        error: 'PIN is required for this action.',
        requirePin: true,
      });
    }

    const valid = await verifyAdminPin(email, pin);
    
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect PIN.',
        requirePin: true,
      });
    }

    // PIN verified, proceed to next middleware/route handler
    next();
  } catch (err) {
    console.error('requireAdminPin error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'PIN verification failed' 
    });
  }
}
