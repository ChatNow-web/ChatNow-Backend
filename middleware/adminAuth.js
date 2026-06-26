const User = require('../models/User');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'harinarayanantr.thoovara@gmail.com').toLowerCase();

const verifyAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMainAdmin = user.email && user.email.toLowerCase() === ADMIN_EMAIL;
    if (!isMainAdmin && !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.adminUser = user;
    req.isMainAdmin = isMainAdmin;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Admin verification failed' });
  }
};

module.exports = { verifyAdmin, ADMIN_EMAIL };
