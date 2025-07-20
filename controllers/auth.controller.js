const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');




exports.register = async (req, res) => {
  try {
    const { email, password, role } = req.body; 
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).send({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user, optionally assigning a default role if not provided
    const newUser = new User({
      email,
      password: hashedPassword,
      role: role || 'user', // Assign 'user' as a default role if not provided
    });
    await newUser.save();

    // Generate JWT for the newly registered user
    const token = jwt.sign(
      {
        id: newUser._id,
        role: newUser.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRATION || '1h',
      }
    );

    res.status(201).send({ message: 'User registered successfully', token, userId: newUser._id  });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
};



exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check user
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send({ message: 'Invalid credentials' });
    }

    // ✅ Include role in the JWT
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role, // ← Include role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRATION || '1h',
      }
    );

    res.send({ message: 'Login successful', token, userId: user._id  });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ message: 'User not found' });
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // expires in 1 hour
    await user.save();

    const resetLink = `http://localhost:3000/reset-password/${token}`;

    // Configure email
    const transporter = nodemailer.createTransport({
      service: 'Gmail', // ✅ use Mailtrap for development/testing
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const result= await transporter.sendMail({
      to: user.email,
      subject: 'Reset Your Password',
      html: `<p>You requested a password reset.</p>
             <p>Click <a href="${resetLink}">here</a> to reset your password. This link will expire in 1 hour.</p>`,
    });

    res.send({ message: 'Password reset email sent',data:result });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() } // valid token
    });

    if (!user) {
      return res.status(400).send({ message: 'Token is invalid or has expired' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.send({ message: 'Password has been reset successfully' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};
// get all user 
exports.getAllUsers = async (req, res) => {
  try {
    const {
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    // Search on name or email (for example)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(Number(page), 1);
    const limitNum = Math.max(Number(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    // Get users with filter, pagination
    const [usersRaw, total] = await Promise.all([
      User.find(filter)
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(filter),
    ]);

    res.json({
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      users: usersRaw,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /auth/:id/role
exports.updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const validRoles = ['user', 'moderator', 'admin'];

  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role specified' });
  }

  try {
    const requestingUser = await User.findById(req.user.id);
    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Prevent changing your own role
    if (requestingUser._id.toString() === targetUser._id.toString()) {
      return res.status(403).json({ message: "You can't change your own role" });
    }

    // Moderator can change user <-> admin
    if (requestingUser.role === 'moderator') {
      if (!['user', 'admin'].includes(targetUser.role)) {
        return res.status(403).json({
          message: 'Moderators cannot change role of other moderators',
        });
      }
      if (!['user', 'admin'].includes(role)) {
        return res.status(403).json({
          message: 'Moderators can only assign user or admin role',
        });
      }
    }

    // Admin can only promote user -> admin
    if (requestingUser.role === 'admin') {
      if (targetUser.role !== 'user') {
        return res.status(403).json({
          message: 'Admins can only promote users to admin',
        });
      }
      if (role !== 'admin') {
        return res.status(403).json({
          message: 'Admins can only assign admin role',
        });
      }
    }

    targetUser.role = role;
    await targetUser.save();

    res.status(200).json({
      message: 'User role updated successfully',
      user: targetUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Load both the requester and the target user
    const requestingUser = await User.findById(req.user.id);
    const targetUser     = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // 2. Prevent self‑deletion
    if (requestingUser._id.equals(targetUser._id)) {
      return res.status(403).json({ message: "You can't delete your own account" });
    }

    // 3. Authorization logic based on requester.role
    switch (requestingUser.role) {
      case 'moderator':
        // Moderators can delete anyone except themselves (already checked)
        break;

      case 'admin':
        // Admins can only delete plain users
        if (targetUser.role !== 'user') {
          return res.status(403).json({
            message: 'Admins can only delete regular users, not moderators or other admins',
          });
        }
        break;

      default:
        // All other roles are forbidden
        return res.status(403).json({ message: 'Access denied' });
    }

    // 4. Perform deletion
    await targetUser.deleteOne();
    res.status(200).json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};



