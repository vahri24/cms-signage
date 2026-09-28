const express = require('express');
const auth = require('../auth');
const store = require('../store');
const config = require('../config');

const router = express.Router();

router.get('/', auth.requireLogin, (req, res) => {
  const cfg = store.readConfig();
  res.render('index', {
    displays: cfg.displays || {},
    username: auth.currentUsername(req),
    role: auth.currentRole(req),
    isSuperadmin: auth.isSuperadmin(req),
    playerBaseUrl: config.PLAYER_BASE_URL.replace(/\/+$/, '') + '/index.html',
  });
});

module.exports = router;
