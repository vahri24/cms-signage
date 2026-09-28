const bcrypt = require('bcryptjs');
const store = require('./store');

async function attemptLogin(req, username, password) {
  const data = store.loadUsers();
  const user = data.users.find((u) => u.username === username);

  if (user) {
    if (user.disabled) {
      await store.auditLog('login_failed', { reason: 'disabled' }, username);
      return false;
    }
    if (bcrypt.compareSync(password, user.password_hash)) {
      req.session.signageAdmin = true;
      req.session.signageAdminUser = username;
      req.session.signageAdminRole = user.role;
      await store.auditLog('login', {}, username);
      return true;
    }
  }

  await store.auditLog('login_failed', {}, username);
  return false;
}

function isLoggedIn(req) {
  return !!(req.session && req.session.signageAdmin === true);
}

function currentUsername(req) {
  return (req.session && req.session.signageAdminUser) || null;
}

function currentRole(req) {
  return (req.session && req.session.signageAdminRole) || null;
}

function isSuperadmin(req) {
  return currentRole(req) === 'superadmin';
}

function requireLogin(req, res, next) {
  if (!isLoggedIn(req)) {
    res.redirect('/login');
    return;
  }
  next();
}

function requireSuperadmin(req, res, next) {
  if (!isLoggedIn(req)) {
    res.redirect('/login');
    return;
  }
  if (!isSuperadmin(req)) {
    res.status(403).send('Akses ditolak. Hanya superadmin yang bisa mengakses halaman ini.');
    return;
  }
  next();
}

module.exports = {
  attemptLogin,
  isLoggedIn,
  currentUsername,
  currentRole,
  isSuperadmin,
  requireLogin,
  requireSuperadmin,
};
