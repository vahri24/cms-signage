const express = require('express');
const auth = require('../auth');
const store = require('../store');

const router = express.Router();

const SKIP_KEYS = new Set(['ts', 'user', 'action']);

function detailText(entry) {
  const parts = [];
  for (const [k, v] of Object.entries(entry)) {
    if (SKIP_KEYS.has(k)) continue;
    parts.push(`${k}=${typeof v === 'boolean' ? (v ? 'true' : 'false') : v}`);
  }
  return parts.join(', ');
}

router.get('/audit', auth.requireLogin, (req, res) => {
  const entries = store.readAuditEntries(500);
  res.render('audit', {
    entries,
    detailText,
    username: auth.currentUsername(req),
    role: auth.currentRole(req),
    isSuperadmin: auth.isSuperadmin(req),
  });
});

module.exports = router;
