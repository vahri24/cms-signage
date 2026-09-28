const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const auth = require('../auth');
const store = require('../store');
const config = require('../config');

const router = express.Router();

const GROUPS = {
  displays: { keyPrefix: 'tv' },
  areas: { keyPrefix: 'area' },
};

function safeFilename(original) {
  const ext = path.extname(original).slice(1).toLowerCase();
  const base = path
    .basename(original, path.extname(original))
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  const unique = crypto.randomBytes(4).toString('hex').slice(0, 6);
  return `${base}-${unique}.${ext}`;
}

function fileUsedElsewhere(cfg, group, filename, exceptKey) {
  for (const [key, item] of Object.entries(cfg[group])) {
    if (key === exceptKey) continue;
    if ((item.slides || []).some((s) => s.file === filename)) return true;
  }
  return false;
}

function nextGroupKey(cfg, group) {
  const prefix = GROUPS[group].keyPrefix;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const key of Object.keys(cfg[group])) {
    const m = re.exec(key);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${max + 1}`;
}

// Lifecycle actions (add/rename/delete the group item itself) get a
// group-specific audit action name so /audit stays legible; the content
// actions (upload/delete/save/copy) keep one name for both groups, with
// `group` recorded in the audit details instead.
function lifecycleAuditAction(base, group) {
  return group === 'areas' ? `${base}_area` : `${base}_display`;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      store.ensureDir(config.MEDIA_DIR);
      cb(null, config.MEDIA_DIR);
    },
    filename: (req, file, cb) => cb(null, safeFilename(file.originalname)),
  }),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const isImage = config.ALLOWED_IMAGE_EXT.includes(ext);
    const isVideo = config.ALLOWED_VIDEO_EXT.includes(ext);
    if (!isImage && !isVideo) {
      req.uploadRejectedExt = ext;
      cb(null, false);
      return;
    }
    req.uploadIsVideo = isVideo;
    cb(null, true);
  },
});

async function handleAction(req, res) {
  const action = req.body.action || req.query.action || '';
  const displayId = req.body.display || req.query.display || '';
  const group = req.body.group || req.query.group || 'displays';
  const username = auth.currentUsername(req);

  if (!GROUPS[group]) {
    res.json({ ok: false, error: 'Group tidak dikenal: ' + group });
    return;
  }

  const cfg = store.readConfig();

  if (displayId && !cfg[group][displayId]) {
    res.json({ ok: false, error: 'Data tidak ditemukan: ' + displayId });
    return;
  }

  switch (action) {
    case 'upload': {
      if (!displayId) {
        res.json({ ok: false, error: 'Tujuan upload tidak disebutkan.' });
        return;
      }
      if (!req.file) {
        const msg = req.uploadRejectedExt
          ? `Tipe file tidak didukung: .${req.uploadRejectedExt}`
          : 'Upload gagal atau tidak ada file.';
        res.json({ ok: false, error: msg });
        return;
      }

      const isVideo = req.uploadIsVideo;
      cfg[group][displayId].slides.push({
        file: req.file.filename,
        type: isVideo ? 'video' : 'image',
        duration: isVideo ? config.DEFAULT_VIDEO_DURATION : config.DEFAULT_IMAGE_DURATION,
      });
      await store.writeConfig(cfg);
      await store.auditLog('upload', { group, display: displayId, file: req.file.filename }, username);

      res.json({ ok: true, slides: cfg[group][displayId].slides });
      return;
    }

    case 'delete': {
      if (!displayId) {
        res.json({ ok: false, error: 'Tujuan tidak disebutkan.' });
        return;
      }
      const filename = path.basename(req.body.file || '');
      if (!filename) {
        res.json({ ok: false, error: 'Nama file tidak valid.' });
        return;
      }

      cfg[group][displayId].slides = cfg[group][displayId].slides.filter((s) => s.file !== filename);

      if (!fileUsedElsewhere(cfg, group, filename, displayId)) {
        const filePath = path.join(config.MEDIA_DIR, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      await store.writeConfig(cfg);
      await store.auditLog('delete', { group, display: displayId, file: filename }, username);
      res.json({ ok: true, slides: cfg[group][displayId].slides });
      return;
    }

    case 'save': {
      if (!displayId) {
        res.json({ ok: false, error: 'Tujuan tidak disebutkan.' });
        return;
      }
      const slides = req.body.slides;
      if (!Array.isArray(slides)) {
        res.json({ ok: false, error: 'Data tidak valid.' });
        return;
      }

      const clean = [];
      for (const s of slides) {
        if (!s || typeof s.file === 'undefined' || typeof s.type === 'undefined') continue;
        clean.push({
          file: path.basename(s.file),
          type: s.type === 'video' ? 'video' : 'image',
          duration: s.duration !== undefined ? parseInt(s.duration, 10) || 0 : config.DEFAULT_IMAGE_DURATION,
        });
      }

      cfg[group][displayId].slides = clean;
      await store.writeConfig(cfg);
      await store.auditLog('save_order', { group, display: displayId, count: clean.length }, username);
      res.json({ ok: true, slides: clean });
      return;
    }

    case 'copy_to': {
      const targetDisplay = req.body.target || '';
      const filename = path.basename(req.body.file || '');
      if (!displayId || !targetDisplay || !cfg[group][targetDisplay]) {
        res.json({ ok: false, error: 'Data tidak lengkap.' });
        return;
      }
      const source = (cfg[group][displayId].slides || []).find((s) => s.file === filename);
      if (!source) {
        res.json({ ok: false, error: 'Konten tidak ditemukan.' });
        return;
      }
      cfg[group][targetDisplay].slides.push(source);
      await store.writeConfig(cfg);
      await store.auditLog('copy_to', { group, display: displayId, target: targetDisplay, file: filename }, username);
      res.json({ ok: true, slides: cfg[group][displayId].slides });
      return;
    }

    case 'add_display': {
      const name = (req.body.name || '').trim();
      if (name === '') {
        res.json({ ok: false, error: 'Nama tidak boleh kosong.' });
        return;
      }
      const key = nextGroupKey(cfg, group);
      cfg[group][key] = { name, slides: [] };
      await store.writeConfig(cfg);
      await store.auditLog(lifecycleAuditAction('add', group), { group, display: key, name }, username);
      res.json({ ok: true, key, name });
      return;
    }

    case 'rename_display': {
      const name = (req.body.name || '').trim();
      if (!displayId || name === '') {
        res.json({ ok: false, error: 'Data tidak lengkap.' });
        return;
      }
      const oldName = cfg[group][displayId].name || displayId;
      cfg[group][displayId].name = name;
      await store.writeConfig(cfg);
      await store.auditLog(
        lifecycleAuditAction('rename', group),
        { group, display: displayId, old_name: oldName, new_name: name },
        username
      );
      res.json({ ok: true, name });
      return;
    }

    case 'delete_display': {
      if (!displayId) {
        res.json({ ok: false, error: 'Tujuan tidak disebutkan.' });
        return;
      }
      const name = cfg[group][displayId].name || displayId;
      for (const s of cfg[group][displayId].slides || []) {
        if (!fileUsedElsewhere(cfg, group, s.file, displayId)) {
          const filePath = path.join(config.MEDIA_DIR, s.file);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      }
      delete cfg[group][displayId];
      await store.writeConfig(cfg);
      await store.auditLog(lifecycleAuditAction('delete', group), { group, display: displayId, name }, username);
      res.json({ ok: true });
      return;
    }

    default:
      res.json({ ok: false, error: 'Aksi tidak dikenal.' });
  }
}

router.post('/api/actions', (req, res, next) => {
  if (!auth.isLoggedIn(req)) {
    res.status(401).json({ ok: false, error: 'Belum login' });
    return;
  }
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.json({ ok: false, error: `File terlalu besar. Maks ${config.MAX_UPLOAD_MB}MB.` });
        return;
      }
      res.json({ ok: false, error: 'Upload gagal.' });
      return;
    }
    handleAction(req, res).catch(next);
  });
});

module.exports = router;
