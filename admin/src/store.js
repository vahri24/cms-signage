const fs = require('fs');
const path = require('path');
const config = require('./config');

// Serializes writes to a given file within this process, replacing PHP's
// LOCK_EX (which guarded concurrent PHP-FPM/Apache worker processes; here a
// single Node process handles all requests, so a per-file promise chain is
// the equivalent guard against interleaved writes).
class FileMutex {
  constructor() {
    this.chain = Promise.resolve();
  }
  run(fn) {
    const result = this.chain.then(fn, fn);
    this.chain = result.then(() => {}, () => {});
    return result;
  }
}

const usersMutex = new FileMutex();
const configMutex = new FileMutex();
const auditMutex = new FileMutex();
const devicesMutex = new FileMutex();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadUsers() {
  if (!fs.existsSync(config.USERS_FILE)) {
    ensureDir(config.DATA_DIR);
    const seed = {
      users: [
        {
          username: config.BOOTSTRAP_ADMIN_USERNAME,
          password_hash: config.BOOTSTRAP_ADMIN_PASSWORD_HASH,
          role: 'superadmin',
          disabled: false,
          created_at: new Date().toISOString(),
        },
      ],
    };
    fs.writeFileSync(config.USERS_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  try {
    const data = JSON.parse(fs.readFileSync(config.USERS_FILE, 'utf8'));
    if (!data || !Array.isArray(data.users)) return { users: [] };
    return data;
  } catch {
    return { users: [] };
  }
}

function saveUsers(data) {
  return usersMutex.run(() => {
    ensureDir(config.DATA_DIR);
    fs.writeFileSync(config.USERS_FILE, JSON.stringify(data, null, 2));
  });
}

function auditLog(action, details = {}, user = 'unknown') {
  return auditMutex.run(() => {
    ensureDir(config.DATA_DIR);
    const entry = {
      ts: new Date().toISOString(),
      user,
      action,
      ...details,
    };
    fs.appendFileSync(config.AUDIT_LOG_FILE, JSON.stringify(entry) + '\n');
  });
}

function readAuditEntries(limit = 500) {
  if (!fs.existsSync(config.AUDIT_LOG_FILE)) return [];
  const lines = fs.readFileSync(config.AUDIT_LOG_FILE, 'utf8').split('\n').filter(Boolean);
  const tail = lines.slice(-limit);
  const entries = [];
  for (const line of tail.reverse()) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }
  return entries;
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
      // areas/ is a newer key - default it so old config.json files (only
      // "displays") keep working with no migration step.
      areas: isPlainObject(data && data.areas) ? data.areas : {},
    };
  } catch {
    return { displays: {}, areas: {} };
  }
}

function writeConfig(data) {
  return configMutex.run(() => {
    ensureDir(config.MEDIA_DIR);
    fs.writeFileSync(config.CONFIG_FILE, JSON.stringify(data, null, 2));
  });
}

function loadDevices() {
  if (!fs.existsSync(config.DEVICES_FILE)) return { devices: [] };
  try {
    const data = JSON.parse(fs.readFileSync(config.DEVICES_FILE, 'utf8'));
    if (!data || !Array.isArray(data.devices)) return { devices: [] };
    return data;
  } catch {
    return { devices: [] };
  }
}

function saveDevices(data) {
  return devicesMutex.run(() => {
    ensureDir(config.DEVICES_DIR);
    fs.writeFileSync(config.DEVICES_FILE, JSON.stringify(data, null, 2));
  });
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

module.exports = {
  loadUsers,
  saveUsers,
  auditLog,
  readAuditEntries,
  readConfig,
  writeConfig,
  loadDevices,
  saveDevices,
  readHeartbeats,
  ensureDir,
};
