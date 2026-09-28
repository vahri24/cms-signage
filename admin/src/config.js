// KONFIGURASI ADMIN PANEL
// ------------------------
// User admin dikelola dari halaman /users (lihat src/routes/users.js), bukan
// konstanta di sini. BOOTSTRAP_ADMIN_* di bawah HANYA dipakai sekali secara
// otomatis untuk membuat akun superadmin pertama saat data/users.json belum
// ada sama sekali (instalasi baru / volume baru). Setelah itu, kelola
// password lewat halaman Users - ganti bootstrap password ini juga supaya
// tidak ada yang bisa login pakai default lama.
//
// Cara membuat hash baru:
//   node -e "console.log(require('bcryptjs').hashSync('password_baru_kamu', 10))"
//
// Default password bawaan: admin123
// WAJIB DIGANTI sebelum dipakai di production!

const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');

module.exports = {
  BOOTSTRAP_ADMIN_USERNAME: 'admin',
  BOOTSTRAP_ADMIN_PASSWORD_HASH: '$2b$10$yDj/uizKqrBy7cqLt2Yq1e71f.bQRPaxSxo27ie7qkjpmVMyR2gtG',

  MEDIA_DIR: path.join(ROOT_DIR, 'media'),
  CONFIG_FILE: path.join(ROOT_DIR, 'media', 'config.json'),

  // data/ menyimpan users.json (akun admin) & audit log - sengaja DIPISAH dari
  // media/ karena media/ juga di-mount (read-only) ke container player publik
  // dan disajikan sebagai file statis; kalau users.json/audit log ikut taruh
  // di media/ maka keduanya jadi bisa didownload publik.
  DATA_DIR: path.join(ROOT_DIR, 'data'),
  USERS_FILE: path.join(ROOT_DIR, 'data', 'users.json'),
  AUDIT_LOG_FILE: path.join(ROOT_DIR, 'data', 'audit.log.jsonl'),

  // devices/ holds Android TV device tokens (see admin/src/routes/devices.js).
  // Kept separate from data/ (admin-only) and media/ (public) - it's
  // read-write here, read-only in player/ (which verifies tokens against
  // it but never writes), and never mounted anywhere else.
  DEVICES_DIR: path.join(ROOT_DIR, 'devices'),
  DEVICES_FILE: path.join(ROOT_DIR, 'devices', 'devices.json'),

  // heartbeats/ holds last-seen timestamps written by player/ every time a
  // device successfully polls /v1/content (see player/src/devices.js). Unlike
  // devices.json (identity/tokens - admin-write, player-read-only), this is
  // low-sensitivity operational telemetry, so it's read-write from BOTH
  // services - keeping it out of devices.json means player never needs write
  // access to the file that actually holds device tokens.
  HEARTBEATS_DIR: path.join(ROOT_DIR, 'heartbeats'),
  HEARTBEATS_FILE: path.join(ROOT_DIR, 'heartbeats', 'heartbeats.json'),

  // Admin jalan sebagai service terpisah (internal-only) dari player
  // (public), jadi base URL player TIDAK BISA diturunkan dari lokasi admin
  // panel sendiri - harus di-set eksplisit ke hostname publik player.
  PLAYER_BASE_URL: 'https://signage.seindonesia.co.id/',

  // Dipakai untuk menandatangani session cookie. Ganti ke string acak
  // panjang di production (lihat README).
  SESSION_SECRET: process.env.SESSION_SECRET || 'ganti-session-secret-ini-di-production',

  MAX_UPLOAD_MB: 50,
  ALLOWED_IMAGE_EXT: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  ALLOWED_VIDEO_EXT: ['mp4', 'webm', 'mov'],
  DEFAULT_IMAGE_DURATION: 8,
  DEFAULT_VIDEO_DURATION: 0, // 0 = putar sampai video selesai
};
