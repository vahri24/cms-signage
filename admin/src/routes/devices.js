const express = require('express');
const crypto = require('crypto');
const auth = require('../auth');
const store = require('../store');

const router = express.Router();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// The Android app polls /v1/content every 60s (see devices/MainActivity.kt,
// POLL_INTERVAL_MS) - 2.5x that tolerates one missed beat plus jitter before
// a device is actually considered offline instead of just running slightly late.
const ONLINE_THRESHOLD_MS = 150000;

function relativeLabel(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  return `${day} hari lalu`;
}

function heartbeatStatus(deviceId, heartbeats) {
  const hb = heartbeats[deviceId];
  const lastSeenMs = hb && hb.last_seen ? Date.parse(hb.last_seen) : NaN;
  if (Number.isNaN(lastSeenMs)) {
    return { state: 'unseen', label: 'Belum pernah terhubung' };
  }
  const age = Date.now() - lastSeenMs;
  const rel = relativeLabel(age);
  return age <= ONLINE_THRESHOLD_MS
    ? { state: 'online', label: `Online · ${rel}` }
    : { state: 'offline', label: `Offline · terakhir ${rel}` };
}

function computeDeviceStatus(devices, heartbeats) {
  const result = {};
  devices.forEach((d) => {
    result[d.id] = heartbeatStatus(d.id, heartbeats);
  });
  return result;
}

function renderDevicesPage(req, res, extra = {}) {
  const devices = store.loadDevices().devices;
  const cfg = store.readConfig();
  const deviceStatus = computeDeviceStatus(devices, store.readHeartbeats());
  res.render('devices', {
    devices,
    areas: cfg.areas || {},
    deviceStatus,
    username: auth.currentUsername(req),
    role: auth.currentRole(req),
    isSuperadmin: auth.isSuperadmin(req),
    error: '',
    success: '',
    newToken: null,
    ...extra,
  });
}

router.get('/devices', auth.requireLogin, (req, res) => {
  renderDevicesPage(req, res);
});

// Polled client-side every ~20s (see views/devices.ejs) so the online/offline
// column updates live without a full page reload.
router.get('/devices/status', auth.requireLogin, (req, res) => {
  const devices = store.loadDevices().devices;
  const deviceStatus = computeDeviceStatus(devices, store.readHeartbeats());
  res.json({ ok: true, devices: deviceStatus });
});

router.post('/devices', auth.requireLogin, async (req, res) => {
  const data = store.loadDevices();
  const formAction = req.body.form_action || '';
  const currentUsername = auth.currentUsername(req);
  const cfg = store.readConfig();

  let error = '';
  let success = '';
  let newToken = null;

  if (formAction === 'create') {
    const name = (req.body.name || '').trim();
    const area = req.body.area || '';

    if (name === '') {
      error = 'Nama device tidak boleh kosong.';
    } else if (!area || !cfg.areas[area]) {
      error = 'Pilih Area yang valid untuk device ini.';
    } else {
      const token = crypto.randomBytes(32).toString('base64url');
      const device = {
        id: crypto.randomUUID(),
        name,
        area,
        token_hash: hashToken(token),
        disabled: false,
        created_at: new Date().toISOString(),
        created_by: currentUsername,
      };
      data.devices.push(device);
      await store.saveDevices(data);
      await store.auditLog('create_device', { device: device.id, name, area }, currentUsername);
      success = `Device "${name}" dibuat.`;
      newToken = token;
    }
  } else if (formAction === 'toggle') {
    const id = req.body.id || '';
    const target = data.devices.find((d) => d.id === id);
    if (!target) {
      error = 'Device tidak ditemukan.';
    } else {
      target.disabled = !target.disabled;
      await store.saveDevices(data);
      await store.auditLog('update_device', { device: id, name: target.name, disabled: target.disabled }, currentUsername);
      success = 'Status device diperbarui.';
    }
  } else if (formAction === 'delete') {
    const id = req.body.id || '';
    const target = data.devices.find((d) => d.id === id);
    if (!target) {
      error = 'Device tidak ditemukan.';
    } else {
      data.devices = data.devices.filter((d) => d.id !== id);
      await store.saveDevices(data);
      await store.auditLog('delete_device', { device: id, name: target.name }, currentUsername);
      success = `Device "${target.name}" dihapus.`;
    }
  }

  renderDevicesPage(req, res, { error, success, newToken });
});

module.exports = router;
