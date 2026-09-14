import { AlumniSignup, User } from '../database/index.js';
import admin from '../firebaseAdmin/firebaseAdmin.js';
import crypto from 'crypto';
import { sendEmail } from '../utils/adminEmailVerification.js';
import { buildUniqueUsername } from '../utils/alumniApproval.js';

function inferMimeFromName(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (n.endsWith('.doc')) return 'application/msword';
  return null;
}

// List alumni signups (optionally filter by status)
export const listAlumniSignups = async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const filter = status ? { status } : {};
    const signups = await AlumniSignup.find(filter)
      .select('-transcriptData')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, signups });
  } catch (err) {
    console.error('listAlumniSignups error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list alumni signups' });
  }
};

// Get signup detail (without sending heavy binary by default)
export const getAlumniSignupDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const signup = await AlumniSignup.findById(id).lean();
    if (!signup) return res.status(404).json({ success: false, error: 'Signup not found' });
    const hasTranscript = !!(signup.transcriptData && signup.transcriptData.length);
    const out = { ...signup, transcriptData: undefined, hasTranscript };
    return res.json({ success: true, signup: out });
  } catch (err) {
    console.error('getAlumniSignupDetail error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get signup detail' });
  }
};

// Download transcript binary
export const downloadAlumniTranscript = async (req, res) => {
  try {
    const { id } = req.params;
    const signup = await AlumniSignup.findById(id);
    if (!signup) return res.status(404).json({ success: false, error: 'Signup not found' });
    if (!signup.transcriptData || !signup.transcriptData.length) return res.status(404).json({ success: false, error: 'No transcript available' });

    const filename = signup.transcriptOriginalName || `transcript-${signup.id}`;
    const mime = signup.transcriptMime || inferMimeFromName(filename) || 'application/octet-stream';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', signup.transcriptData.length);
    return res.send(signup.transcriptData);
  } catch (err) {
    console.error('downloadAlumniTranscript error:', err);
    return res.status(500).json({ success: false, error: 'Failed to download transcript' });
  }
};

// Approve signup (mark as approved)
export const approveAlumniSignup = async (req, res) => {
  try {
    const { id } = req.params;
    const adminEmail = (req.admin && req.admin.email) || 'admin';
    const signup = await AlumniSignup.findById(id);
    if (!signup) return res.status(404).json({ success: false, error: 'Signup not found' });
    if (signup.status === 'approved') return res.json({ success: true, message: 'Already approved' });

    const email = String(signup.alumniEmail || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Invalid alumni email' });
    }
    const displayName = signup.name || '';
    const tempPassword = crypto.randomBytes(8).toString('hex'); // 16 hex chars

    let uid = null;
    try {
      const userRecord = await admin.auth().createUser({
        email,
        password: tempPassword,
        displayName,
        emailVerified: true,
      });
      uid = userRecord.uid;
    } catch (createErr) {
      if (createErr?.code === 'auth/email-already-exists') {
        try {
          const existing = await admin.auth().getUserByEmail(email);
          uid = existing.uid;
          await admin.auth().updateUser(uid, {
            password: tempPassword,
            displayName,
            emailVerified: true,
            disabled: false,
          });
        } catch (updateErr) {
          console.error('Failed to update existing Firebase user:', updateErr);
          return res.status(500).json({ success: false, error: 'Failed to update existing Firebase account' });
        }
      } else {
        console.error('Failed to create Firebase user:', createErr);
        return res.status(500).json({ success: false, error: 'Failed to create Firebase account' });
      }
    }

    if (!uid) {
      console.error('Firebase user UID missing after create/update action');
      return res.status(500).json({ success: false, error: 'Failed to provision Firebase user' });
    }

    try {
      let userDoc = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const username = await buildUniqueUsername(displayName, email, uid, async (candidate) => {
          const existing = await User.findOne({ username: candidate }).select('_id').lean();
          return Boolean(existing);
        });

        try {
          userDoc = await User.findOneAndUpdate(
            { email },
            {
              $set: {
                firebaseId: uid,
                name: displayName,
                email,
                username,
                accountType: 'alumni',
                accountStatus: 'active',
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          break;
        } catch (profileErr) {
          if (profileErr?.code !== 11000 || attempt === 4) throw profileErr;
        }
      }

      if (!userDoc) {
        throw new Error('Failed to create or update alumni profile');
      }
    } catch (e) {
      console.error('Failed to create/update user document:', e);
      return res.status(500).json({ success: false, error: 'Failed to provision user profile' });
    }

    signup.status = 'approved';
    signup.reviewedAt = new Date();
    signup.reviewedBy = adminEmail;
    await signup.save();

    try {
      const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
      const subject = 'CampusBuzz — Alumni signup approved';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width:600px;">
          <h2>CampusBuzz — Signup Approved</h2>
          <p>Hi ${displayName || ''},</p>
          <p>Your alumni signup request has been approved. You may now sign in using the email address <strong>${email}</strong> and the temporary password below. For security, please reset your password after signing in.</p>
          <p><strong>Temporary password:</strong> <code>${tempPassword}</code></p>
          <p><a href="${frontend}/login" style="background:#193965;color:white;padding:8px 12px;border-radius:4px;text-decoration:none;">Sign in</a></p>
          <p>If you did not request this, please contact support.</p>
        </div>
      `;
      const text = `Your alumni signup has been approved. Temporary password: ${tempPassword}. Sign in at ${frontend}/login and reset your password.`;
      const mail = await sendEmail({ to: email, subject, text, html });
      if (!mail?.success) console.warn('sendEmail returned failure:', mail);
    } catch (mailErr) {
      console.error('Failed to send approval email:', mailErr);
    }

    return res.json({ success: true, message: 'Signup approved' });
  } catch (err) {
    console.error('approveAlumniSignup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to approve signup' });
  }
};

// Reject signup (mark as rejected)
export const rejectAlumniSignup = async (req, res) => {
  try {
    const { id } = req.params;
    const adminEmail = (req.admin && req.admin.email) || 'admin';
    const signup = await AlumniSignup.findById(id);
    if (!signup) return res.status(404).json({ success: false, error: 'Signup not found' });
    if (signup.status === 'rejected') return res.json({ success: true, message: 'Already rejected' });

    signup.status = 'rejected';
    signup.reviewedAt = new Date();
    signup.reviewedBy = adminEmail;
    await signup.save();
    // Send rejection email
    try {
      const email = String(signup.alumniEmail || '').trim().toLowerCase();
      const subject = 'CampusBuzz — Alumni signup rejected';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width:600px;">
          <h2>CampusBuzz — Signup Rejected</h2>
          <p>Hi ${signup.name || ''},</p>
          <p>We are sorry to inform you that your alumni signup request has been rejected. If you believe this is a mistake, please contact support.</p>
        </div>
      `;
      const text = `Your alumni signup request has been rejected. Contact support if you have questions.`;
      const mail = await sendEmail({ to: email, subject, text, html });
      if (!mail?.success) console.warn('sendEmail returned failure:', mail);
    } catch (mailErr) {
      console.error('Failed to send rejection email:', mailErr);
    }

    return res.json({ success: true, message: 'Signup rejected' });
  } catch (err) {
    console.error('rejectAlumniSignup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reject signup' });
  }
};
