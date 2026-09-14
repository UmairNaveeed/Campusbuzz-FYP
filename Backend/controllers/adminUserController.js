import mongoose from 'mongoose';
import admin from '../firebaseAdmin/firebaseAdmin.js';
import { User, Post } from '../database/index.js';
import { ADMIN_EMAILS } from '../utils/adminConfig.js';
import { deleteUserById } from '../utils/deleteUserData.js';
import { verifyAdminPin } from '../utils/adminPin.js';
import { sendEmail } from '../utils/adminEmailVerification.js';

async function resolveUserEmail(user) {
  const directEmail = String(user?.email || '').trim().toLowerCase();
  if (directEmail) return directEmail;

  if (user?.firebaseId) {
    try {
      const firebaseUser = await admin.auth().getUser(user.firebaseId);
      const firebaseEmail = String(firebaseUser?.email || '').trim().toLowerCase();
      if (firebaseEmail) return firebaseEmail;
    } catch (err) {
      console.warn('Unable to resolve Firebase email for user:', user.firebaseId, err.message);
    }
  }

  const rollNumber = String(user?.rollNumber || '').trim();
  if (/^\d{9,11}$/.test(rollNumber)) {
    return `${rollNumber}@gift.edu.pk`;
  }

  return null;
}

function formatUser(row) {
  const status = row.accountStatus === 'suspended' ? 'Suspended' : 'Active';
  return {
    id: String(row._id),
    username: row.username || '—',
    email: row.email || '—',
    name: row.name || '',
    status,
    accountStatus: row.accountStatus || 'active',
    department: row.department || '',
    program: row.program || '',
    createdAt: row.createdAt || null,
  };
}

function formatUserDetail(row) {
  return {
    ...formatUser(row),
    bio: row.bio || '',
    location: row.location || '',
    rollNumber: row.rollNumber || '',
    currentStatus: row.currentStatus || '',
    startYear: row.startYear ?? null,
    endYear: row.endYear ?? null,
    profilePhoto: row.profilePhoto || null,
    coverPhoto: row.coverPhoto || null,
  };
}

function formatPostSummary(row) {
  return {
    id: String(row._id),
    content: row.content,
    image: row.image || null,
    createdAt: row.createdAt,
    likesCount: row.likesCount ?? 0,
    commentsCount: row.commentsCount ?? 0,
    sentiment: row.SentimentLabel || 'neutral',
  };
}

function isValidUserId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * GET /api/admin/users
 */
export const listAdminUsers = async (req, res) => {
  try {
    const users = await User.find({
      email: { $nin: ADMIN_EMAILS },
    })
      .select('username email name accountStatus department program createdAt')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    return res.json({
      success: true,
      users: users.map(formatUser),
    });
  } catch (err) {
    console.error('listAdminUsers error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load users' });
  }
};

/**
 * GET /api/admin/users/suspended?q=
 */
export const listSuspendedAdminUsers = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = {
      email: { $nin: ADMIN_EMAILS },
      accountStatus: 'suspended',
    };

    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ username: regex }, { email: regex }, { name: regex }];
    }

    const users = await User.find(filter)
      .select('username email name accountStatus createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(1000)
      .lean();

    return res.json({
      success: true,
      total: users.length,
      users: users.map((row) => ({
        ...formatUser(row),
        suspendedAt: row.updatedAt || row.createdAt || null,
      })),
    });
  } catch (err) {
    console.error('listSuspendedAdminUsers error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load suspended users' });
  }
};

/**
 * GET /api/admin/users/:userId
 */
export const getAdminUserDetail = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    if (ADMIN_EMAILS.includes((user.email || '').trim().toLowerCase())) {
      return res.status(403).json({ success: false, error: 'Cannot view administrator details here' });
    }

    const [posts, postsCount] = await Promise.all([
      Post.find({ authorId: user._id, isDeleted: false })
        .select('content image createdAt likesCount commentsCount SentimentLabel')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Post.countDocuments({ authorId: user._id, isDeleted: false }),
    ]);

    return res.json({
      success: true,
      user: formatUserDetail(user),
      posts: posts.map(formatPostSummary),
      postsCount,
    });
  } catch (err) {
    console.error('getAdminUserDetail error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load user details' });
  }
};

/**
 * PATCH /api/admin/users/:userId/suspend
 * Body: { pin }
 */
export const suspendAdminUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const { pin, reason } = req.body || {};
    const email = req.admin?.email;
    const trimmedReason = String(reason || '').trim();

    // Verify PIN for suspend action
    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'PIN is required to suspend a user.',
        requirePin: true,
      });
    }

    if (!trimmedReason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required to suspend a user.',
      });
    }

    const pinValid = await verifyAdminPin(email, pin);
    if (!pinValid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect PIN.',
        requirePin: true,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    if (ADMIN_EMAILS.includes((user.email || '').trim().toLowerCase())) {
      return res.status(403).json({ success: false, error: 'Cannot suspend an administrator' });
    }

    user.accountStatus = 'suspended';
    await user.save();

    if (user.firebaseId) {
      try {
        await admin.auth().updateUser(user.firebaseId, { disabled: true });
      } catch (err) {
        if (err.code !== 'auth/user-not-found') {
          console.warn('Firebase disable failed:', err.message);
        }
      }
    }

    const notifyEmail = await resolveUserEmail(user);
    console.log(`[📧 Suspend Action - Resolving email...] User: ${user.username}, Roll: ${user.rollNumber || 'N/A'}, Resolved: ${notifyEmail || 'NOT FOUND'}`);
    
    if (notifyEmail) {
      console.log(`[📧 Sending suspension email to...] ${notifyEmail}`);
      const emailResult = await sendEmail({
        to: notifyEmail,
        subject: 'Your CampusBuzz account has been suspended',
        text: `Your CampusBuzz account has been suspended by an administrator. Reason: ${trimmedReason}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #193965;">Account Suspended</h2>
            <p>Hello ${user.name || user.username || 'Student'},</p>
            <p>Your CampusBuzz account has been suspended by an administrator.</p>
            <p><strong>Reason:</strong> ${trimmedReason}</p>
            <p>If you believe this suspension is incorrect, please contact your administrator.</p>
            <p style="color: #666; font-size: 14px;">CampusBuzz Support</p>
          </div>
        `,
      });

      if (emailResult.success) {
        console.log(`✅ Email sent successfully to ${notifyEmail}`);
      } else {
        console.error(`❌ Failed to send suspension email to ${notifyEmail} - Reason: ${emailResult.error}`);
      }
    } else {
      console.warn(`⚠️  No email found for user ${user.username} (ID: ${userId}, Roll: ${user.rollNumber || 'N/A'})`);
    }

    return res.json({ success: true, user: formatUser(user) });
  } catch (err) {
    console.error('suspendAdminUser error:', err);
    return res.status(500).json({ success: false, error: 'Failed to suspend user' });
  }
};

/**
 * PATCH /api/admin/users/:userId/unsuspend
 */
export const unsuspendAdminUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.accountStatus = 'active';
    await user.save();

    if (user.firebaseId) {
      try {
        await admin.auth().updateUser(user.firebaseId, { disabled: false });
      } catch (err) {
        if (err.code !== 'auth/user-not-found') {
          console.warn('Firebase enable failed:', err.message);
        }
      }
    }

    return res.json({ success: true, user: formatUser(user) });
  } catch (err) {
    console.error('unsuspendAdminUser error:', err);
    return res.status(500).json({ success: false, error: 'Failed to unsuspend user' });
  }
};

/**
 * DELETE /api/admin/users/:userId
 * Body: { pin }
 */
export const deleteAdminUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const { pin, reason } = req.body || {};
    const email = req.admin?.email;
    const trimmedReason = String(reason || '').trim();

    // Verify PIN for delete action
    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'PIN is required to delete a user.',
        requirePin: true,
      });
    }

    if (!trimmedReason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required to delete a user.',
      });
    }

    const pinValid = await verifyAdminPin(email, pin);
    if (!pinValid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect PIN.',
        requirePin: true,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    if (ADMIN_EMAILS.includes((user.email || '').trim().toLowerCase())) {
      return res.status(403).json({ success: false, error: 'Cannot delete an administrator' });
    }

    const notifyEmail = await resolveUserEmail(user);
    console.log('📧 Delete Action - Resolving email for user:', { userId, username: user.username, rollNumber: user.rollNumber, resolvedEmail: notifyEmail });
    
    if (notifyEmail) {
      console.log('📧 Sending deletion email to:', notifyEmail);
      const emailResult = await sendEmail({
        to: notifyEmail,
        subject: 'Your CampusBuzz account has been deleted',
        text: `Your CampusBuzz account has been deleted by an administrator. Reason: ${trimmedReason}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #193965;">Account Deleted</h2>
            <p>Hello ${user.name || user.username || 'Student'},</p>
            <p>Your CampusBuzz account has been permanently deleted by an administrator.</p>
            <p><strong>Reason:</strong> ${trimmedReason}</p>
            <p>If you believe this deletion is incorrect, please contact your administrator.</p>
            <p style="color: #666; font-size: 14px;">CampusBuzz Support</p>
          </div>
        `,
      });

      if (emailResult.success) {
        console.log('✅ Deletion email sent successfully to:', notifyEmail);
      } else {
        console.error('❌ Failed to send deletion email to', notifyEmail, ':', emailResult.error);
      }
    } else {
      console.warn('⚠️  No email found for user:', { userId, username: user.username, rollNumber: user.rollNumber });
    }

    await deleteUserById(userId);
    return res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error('deleteAdminUser error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
};
