const fs = require('fs');
const crypto = require('crypto');
const config = require('./config');

// player is read-only for content/identity data (see admin/src/store.js for
// the writable counterpart) - media/config.json and devices/devices.json are
// both bind-mounted read-only in docker-compose.yml. The one exception is
// heartbeats/heartbeats.json (recordHeartbeat below), which is bind-mounted
// read-write in both services since it's disposable telemetry, not identity
// data - losing it just means the admin panel briefly can't tell if a device
// is online, nothing user-facing breaks.

// Serializes writes within this process so two devices heartbeating at the
// same instant can't race and clobber each other's read-modify-write of the
// same JSON file (same pattern as admin/src/store.js's FileMutex).
const heartbeatMutex = (() => {
  let chain = Promise.resolve();
  return {
    run(fn) {
      const result = chain.then(fn, fn);
      chain = result.then(() => {}, () => {});
      return result;
    },
  };
})();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function readConfig() {
  if (!fs.existsSync(config.CONFIG_FILE)) return { displays: {}, areas: {} };
  try {
    const data = JSON.parse(fs.readFileSync(config.CONFIG_FILE, 'utf8'));
    return {
      displays: isPlainObject(data && data.displays) ? data.displays : {},
      areas: isPlainObject(data && data.areas) ? data.areas : {},
    };
  } catch {
    return { displays: {}, areas: {} };
  }
}

function readDevices() {
  if (!fs.existsSync(config.DEVICES_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(config.DEVICES_FILE, 'utf8'));
    if (!data || !Array.isArray(data.devices)) return [];
    return data.devices;
  } catch {
    return [];
  }
}

function findActiveDeviceByToken(token) {
  const hash = hashToken(token);
  const device = readDevices().find((d) => d.token_hash === hash);
  if (!device || device.disabled) return null;
  return device;
}

function readHeartbeats() {
  if (!fs.existsSync(config.HEARTBEATS_FILE)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(config.HEARTBEATS_FILE, 'utf8'));
    return isPlainObject(data) ? data : {};
  } catch {
    return {};
  }
}

function recordHeartbeat(deviceId) {
  return heartbeatMutex
    .run(() => {
      const data = readHeartbeats();
      data[deviceId] = { last_seen: new Date().toISOString() };
      if (!fs.existsSync(config.HEARTBEATS_DIR)) fs.mkdirSync(config.HEARTBEATS_DIR, { recursive: true });
      fs.writeFileSync(config.HEARTBEATS_FILE, JSON.stringify(data, null, 2));
    })
    .catch(() => {
      // Best-effort telemetry - a heartbeat write failure must never break
      // the /v1/content response the device is actually waiting on.
    });
}

module.exports = {
  readConfig,
  findActiveDeviceByToken,
  recordHeartbeat,
};
