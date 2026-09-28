// Same path-math pattern as admin/src/config.js: this file lives two
// directories under the app root (player/src/config.js), and the container
// (docker/player.Dockerfile) preserves that same nesting under
// /var/www/html/player, so media/ and devices/ resolve as siblings of
// player/ either way (local dev or Docker).

const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');

module.exports = {
  MEDIA_DIR: path.join(ROOT_DIR, 'media'),
  CONFIG_FILE: path.join(ROOT_DIR, 'media', 'config.json'),
  DEVICES_FILE: path.join(ROOT_DIR, 'devices', 'devices.json'),

  // Only path player/ ever writes to (see src/devices.js recordHeartbeat) -
  // deliberately separate from devices.json so the read-only guarantee on
  // device identity/tokens (see devices.js comment below) stays intact.
  HEARTBEATS_DIR: path.join(ROOT_DIR, 'heartbeats'),
  HEARTBEATS_FILE: path.join(ROOT_DIR, 'heartbeats', 'heartbeats.json'),
};
