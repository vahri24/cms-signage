<?php
/**
 * KONFIGURASI ADMIN PANEL
 * ------------------------
 * User admin sekarang dikelola dari halaman Users (lihat users.php), bukan
 * konstanta di sini. BOOTSTRAP_ADMIN_* di bawah HANYA dipakai sekali secara
 * otomatis untuk membuat akun superadmin pertama saat data/users.json belum
 * ada sama sekali (instalasi baru / volume EFS baru). Setelah itu, kelola
 * password lewat halaman Users - ganti bootstrap password ini juga supaya
 * tidak ada yang bisa login pakai default lama.
 *
 * Cara membuat hash baru, jalankan sekali di terminal/browser:
 *   php -r "echo password_hash('password_baru_kamu', PASSWORD_DEFAULT);"
 *
 * Default password bawaan: admin123
 * WAJIB DIGANTI sebelum dipakai di production!
 */

define('BOOTSTRAP_ADMIN_USERNAME', 'admin');
define('BOOTSTRAP_ADMIN_PASSWORD_HASH', '$2b$10$yDj/uizKqrBy7cqLt2Yq1e71f.bQRPaxSxo27ie7qkjpmVMyR2gtG');

define('MEDIA_DIR', __DIR__ . '/../media/');
// config.json hidup di dalam media/ supaya satu volume/EFS mount di
// /var/www/html/media sudah meng-cover file upload + state playlist.
define('CONFIG_FILE', MEDIA_DIR . 'config.json');
define('MEDIA_URL_PREFIX', '../media/');

// data/ menyimpan users.json (akun admin) & audit log - sengaja DIPISAH dari
// media/ karena media/ juga di-mount (read-only) ke container player publik
// dan disajikan sebagai file statis; kalau users.json/audit log ikut taruh
// di media/ maka keduanya jadi bisa didownload publik. data/ butuh access
// point EFS sendiri yang HANYA di-mount di service admin (internal-only).
define('DATA_DIR', __DIR__ . '/../data/');
define('USERS_FILE', DATA_DIR . 'users.json');
define('AUDIT_LOG_FILE', DATA_DIR . 'audit.log.jsonl');

// Admin sekarang jalan sebagai service terpisah (internal-only) dari player
// (public), jadi base URL player TIDAK BISA lagi diturunkan dari lokasi admin
// panel sendiri - harus di-set eksplisit ke hostname publik player.
define('PLAYER_BASE_URL', 'https://signage.seindonesia.co.id/');

define('MAX_UPLOAD_MB', 50);
define('ALLOWED_IMAGE_EXT', ['jpg', 'jpeg', 'png', 'gif', 'webp']);
define('ALLOWED_VIDEO_EXT', ['mp4', 'webm', 'mov']);
define('DEFAULT_IMAGE_DURATION', 8);
define('DEFAULT_VIDEO_DURATION', 0); // 0 = putar sampai video selesai
