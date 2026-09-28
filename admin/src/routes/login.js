const express = require('express');
const auth = require('../auth');
const store = require('../store');

const router = express.Router();

router.get('/login', (req, res) => {
  if (auth.isLoggedIn(req)) {
    res.redirect('/');
    return;
  }
  res.render('login', { error: '' });
});

router.post('/login', async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  const ok = await auth.attemptLogin(req, username, password);
  if (ok) {
    res.redirect('/');
    return;
  }
  res.render('login', { error: 'Username atau password salah.' });
});

router.get('/logout', async (req, res) => {
  if (auth.isLoggedIn(req)) {
    await store.auditLog('logout', {}, auth.currentUsername(req));
  }
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
