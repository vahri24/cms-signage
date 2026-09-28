const express = require('express');
const auth = require('../auth');
const store = require('../store');

const router = express.Router();

router.get('/areas', auth.requireLogin, (req, res) => {
  const cfg = store.readConfig();
  res.render('areas', {
    areas: cfg.areas || {},
    username: auth.currentUsername(req),
    role: auth.currentRole(req),
    isSuperadmin: auth.isSuperadmin(req),
  });
});

module.exports = router;
