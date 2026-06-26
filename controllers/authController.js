const User = require('../models/User');
const Room = require('../models/Room');
const { hashPassword, comparePassword } = require('../services/bcrypt');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../services/jwt');
const { validateFirebaseToken } = require('../services/firebase');
const { sanitizeInput } = require('../utils/helpers');
const { sendWelcomeEmail, sendLoginNotification, getDeviceInfo } = require('../services/emailService');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'harinarayanantr.thoovara@gmail.com').toLowerCase();

const generateUniqueUsername = async (base, prefix = '') => {
  const clean = base.replace(/[^a-z0-9]/g, '');
  const maxLength = prefix ? 20 - prefix.length - 5 : 15;
  const truncated = clean.slice(0, Math.min(maxLength, 20));
  const suffix = Math.random().toString(36).substring(2, 6);
  let username = prefix ? `${prefix}${truncated.slice(0, 11)}${suffix}` : `${truncated}${suffix}`;
  username = username.slice(0, 20);

  let exists = await User.findOne({ username });
  while (exists) {
    const newSuffix = Math.random().toString(36).substring(2, 6);
    username = prefix
      ? `${prefix}${truncated.slice(0, 11)}${newSuffix}`.slice(0, 20)
      : `${truncated.slice(0, 15)}${newSuffix}`.slice(0, 20);
    exists = await User.findOne({ username });
  }
  return username;
};

const signup = async (req, res, next) => {
  try {
    const { username, password, email } = req.validated;
    const sanitizedUsername = sanitizeInput(username.toLowerCase());

    const existingUser = await User.findOne({ username: sanitizedUsername });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    if (email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(409).json({ error: 'Email already registered' });
      }
    }

    const passwordHash = await hashPassword(password);

    const userEmail = email ? email.toLowerCase() : undefined;
    const isAdminUser = userEmail === ADMIN_EMAIL;
    const joinedRooms = ['CHATNOW-ALL'];
    if (isAdminUser) joinedRooms.push('ADMIN-CHAT');

    const user = await User.create({
      username: sanitizedUsername,
      email: userEmail,
      passwordHash,
      isAdmin: isAdminUser,
      joinedRooms
    });

    const tokenPayload = { userId: user._id, username: user.username };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const ua = req.headers['user-agent'];
    if (user.email) {
      sendWelcomeEmail(user.email, user.username);
    }

    res.status(201).json({
      userId: user._id,
      token,
      refreshToken,
      user: user.toPublicJSON()
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { username, password } = req.validated;
    const sanitizedUsername = sanitizeInput(username.toLowerCase());

    const user = await User.findOne({ username: sanitizedUsername });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.bannedStatus?.isBanned) {
      return res.status(403).json({ error: 'Account has been banned' });
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastActive = new Date();
    const isAdminUser = user.email && user.email.toLowerCase() === ADMIN_EMAIL;
    if (isAdminUser && !user.isAdmin) {
      user.isAdmin = true;
      if (!user.joinedRooms.includes('ADMIN-CHAT')) {
        user.joinedRooms.push('ADMIN-CHAT');
      }
    }
    await user.save();

    const ua = req.headers['user-agent'];
    if (user.email) {
      sendLoginNotification(user.email, user.username, req.ip, getDeviceInfo(ua));
    }

    const tokenPayload = { userId: user._id, username: user.username };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      userId: user._id,
      token,
      refreshToken,
      user: user.toPublicJSON()
    });
  } catch (error) {
    next(error);
  }
};

const googleAuth = async (req, res, next) => {
  try {
    const { googleToken } = req.validated;
    const firebaseUser = await validateFirebaseToken(googleToken);

    let user = await User.findOne({ firebaseUID: firebaseUser.uid });
    let wasCreated = false;

    if (!user) {
      user = await User.findOne({ email: firebaseUser.email });
      if (user) {
        user.firebaseUID = firebaseUser.uid;
        await user.save();
      }
    }

    if (user && user.bannedStatus?.isBanned) {
      return res.status(403).json({ error: 'Account has been banned' });
    }

    if (!user) {
      wasCreated = true;
      const baseName = (firebaseUser.email || firebaseUser.uid).split('@')[0].toLowerCase();
      const username = await generateUniqueUsername(baseName);

      const fbEmail = firebaseUser.email || undefined;
      const isAdmin3 = fbEmail && fbEmail.toLowerCase() === ADMIN_EMAIL;
      const joinedRooms3 = ['CHATNOW-ALL'];
      if (isAdmin3) joinedRooms3.push('ADMIN-CHAT');

      user = await User.create({
        username,
        email: fbEmail,
        passwordHash: await hashPassword(Math.random().toString(36) + Math.random().toString(36)),
        firebaseUID: firebaseUser.uid,
        isAdmin: isAdmin3,
        joinedRooms: joinedRooms3
      });
    }

    if (!user.joinedRooms.includes('CHATNOW-ALL')) {
      user.joinedRooms.push('CHATNOW-ALL');
    }

    const isAdminUser = user.email && user.email.toLowerCase() === ADMIN_EMAIL;
    if (isAdminUser && !user.isAdmin) {
      user.isAdmin = true;
    }
    if (user.isAdmin && !user.joinedRooms.includes('ADMIN-CHAT')) {
      user.joinedRooms.push('ADMIN-CHAT');
    }

    user.lastActive = new Date();
    await user.save();

    const ua = req.headers['user-agent'];
    if (user.email) {
      if (wasCreated) {
        sendWelcomeEmail(user.email, user.username);
      } else {
        sendLoginNotification(user.email, user.username, req.ip, getDeviceInfo(ua));
      }
    }

    const tokenPayload = { userId: user._id, username: user.username };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      userId: user._id,
      token,
      refreshToken,
      user: user.toPublicJSON()
    });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const decoded = verifyRefreshToken(token);
    if (decoded.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    const tokenPayload = { userId: decoded.userId, username: decoded.username };
    const newToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    return res.status(403).json({ error: 'Invalid refresh token' });
  }
};

const logout = async (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ success: true });
};

const firebaseEmailAuth = async (req, res, next) => {
  try {
    const { googleToken } = req.body;
    const firebaseUser = await validateFirebaseToken(googleToken);
    const { email } = firebaseUser;

    if (!email) {
      return res.status(400).json({ error: 'Email required from Firebase' });
    }

    let user = await User.findOne({ email });
    let wasCreated = false;
    if (!user) {
      wasCreated = true;
      const baseName = email.split('@')[0].toLowerCase();
      const username = await generateUniqueUsername(baseName);
      const isAdminUser = email.toLowerCase() === ADMIN_EMAIL;
      const joinedRooms = ['CHATNOW-ALL'];
      if (isAdminUser) joinedRooms.push('ADMIN-CHAT');

      user = await User.create({
        username,
        email,
        passwordHash: await hashPassword(Math.random().toString(36) + Math.random().toString(36)),
        firebaseUID: firebaseUser.uid,
        isAdmin: isAdminUser,
        joinedRooms
      });
    }

    if (user.bannedStatus?.isBanned) {
      return res.status(403).json({ error: 'Account has been banned' });
    }

    if (!user.joinedRooms.includes('CHATNOW-ALL')) {
      user.joinedRooms.push('CHATNOW-ALL');
    }

    const isAdminUser2 = user.email && user.email.toLowerCase() === ADMIN_EMAIL;
    if (isAdminUser2 && !user.isAdmin) {
      user.isAdmin = true;
    }
    if (user.isAdmin && !user.joinedRooms.includes('ADMIN-CHAT')) {
      user.joinedRooms.push('ADMIN-CHAT');
    }

    user.lastActive = new Date();
    await user.save();

    const ua = req.headers['user-agent'];
    if (user.email) {
      if (wasCreated) {
        sendWelcomeEmail(user.email, user.username);
      } else {
        sendLoginNotification(user.email, user.username, req.ip, getDeviceInfo(ua));
      }
    }

    const tokenPayload = { userId: user._id, username: user.username };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      userId: user._id,
      token,
      refreshToken,
      user: user.toPublicJSON()
    });
  } catch (error) {
    next(error);
  }
};

const anonymousAuth = async (req, res, next) => {
  try {
    const { googleToken } = req.body;
    const firebaseUser = await validateFirebaseToken(googleToken);

    let user = await User.findOne({ firebaseUID: firebaseUser.uid });

    if (!user) {
      const guestCount = await User.countDocuments({ username: /^guest_/ });
      const username = await generateUniqueUsername(`guest${guestCount + 1}`, 'guest_');

      user = await User.create({
        username,
        passwordHash: await hashPassword(Math.random().toString(36) + Math.random().toString(36)),
        firebaseUID: firebaseUser.uid,
        joinedRooms: ['CHATNOW-ALL']
      });
    }

    if (user.bannedStatus?.isBanned) {
      return res.status(403).json({ error: 'Account has been banned' });
    }

    if (!user.joinedRooms.includes('CHATNOW-ALL')) {
      user.joinedRooms.push('CHATNOW-ALL');
    }

    if (user.isAdmin && !user.joinedRooms.includes('ADMIN-CHAT')) {
      user.joinedRooms.push('ADMIN-CHAT');
    }

    user.lastActive = new Date();
    await user.save();

    const tokenPayload = { userId: user._id, username: user.username };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      userId: user._id,
      token,
      refreshToken,
      user: user.toPublicJSON()
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { signup, login, googleAuth, firebaseEmailAuth, anonymousAuth, refresh, logout };
