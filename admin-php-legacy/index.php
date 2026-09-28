<?php
require_once __DIR__ . '/auth.php';
require_login();

$config = json_decode(@file_get_contents(CONFIG_FILE), true);
$displays = $config['displays'] ?? [];
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Signage Admin - Kelola Konten</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="topbar">
    <div class="topbar-title">
      <img class="logo" src="assets/logo.png" alt="Logo">
      <span>Signage Admin</span>
    </div>
    <div class="topbar-actions">
      <a href="audit.php" class="btn btn-ghost">Audit Trail</a>
      <?php if (is_superadmin()): ?><a href="users.php" class="btn btn-ghost">Users</a><?php endif; ?>
      <span class="user-badge"><?= htmlspecialchars(current_username()) ?> · <?= htmlspecialchars(current_role()) ?></span>
      <a href="logout.php" class="btn btn-ghost">Keluar</a>
    </div>
  </header>

  <main class="main">
    <div class="tv-tabs" id="tvTabs">
      <?php foreach ($displays as $key => $d): ?>
        <button class="tv-tab" data-display="<?= htmlspecialchars($key) ?>">
          <?= htmlspecialchars($d['name'] ?? $key) ?>
        </button>
      <?php endforeach; ?>
      <button class="tv-tab tv-tab-add" id="addTvBtn" title="Tambah TV baru">+ Tambah TV</button>
    </div>

    <div class="tv-link-row">
      <span>Link untuk Fully Kiosk di TV ini:</span>
      <code id="tvLinkDisplay">-</code>
      <button class="btn btn-ghost btn-copy" id="copyLinkBtn">Salin Link</button>
      <a href="#" id="previewLink" target="_blank" class="btn btn-ghost">Lihat Tampilan ↗</a>
      <button class="btn btn-ghost btn-copy" id="renameTvBtn">Ubah Nama TV</button>
      <button class="btn btn-danger-outline" id="deleteTvBtn">Hapus TV Ini</button>
    </div>

    <section class="upload-rules">
      <h3>📋 Panduan Upload Konten</h3>
      <ul>
        <li>Format gambar: JPG, PNG, GIF, WEBP &middot; Format video: MP4, WEBM</li>
        <li>Ukuran maksimal file: <strong>50MB</strong> per upload</li>
        <li>Resolusi disarankan: <strong>1920 x 1080 px</strong> (Full HD), orientasi <strong>landscape/mendatar</strong></li>
        <li>Hindari gambar/video portrait — akan tampil terpotong di TV</li>
        <li>Pastikan konten sudah final (harga, tanggal promo, dll) sebelum diupload</li>
        <li>Video otomatis di-mute saat tampil di TV (kebijakan autoplay browser)</li>
      </ul>
    </section>

    <section class="upload-zone" id="dropzone">
      <input type="file" id="fileInput" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden>
      <div class="upload-inner">
        <div class="upload-icon">＋</div>
        <p><strong>Klik untuk pilih file</strong> atau seret gambar/video ke sini</p>
        <p class="upload-hint">Format: JPG, PNG, GIF, WEBP, MP4, WEBM &middot; Maks 50MB</p>
      </div>
    </section>

    <div id="uploadStatus"></div>

    <div class="section-header">
      <h2>Konten Aktif <span id="slideCount" class="count-badge"></span></h2>
      <button id="saveOrderBtn" class="btn btn-primary" disabled>Simpan Urutan</button>
    </div>
    <p class="hint-text">Seret kartu untuk mengubah urutan tampil. Perubahan urutan/durasi baru berlaku setelah klik "Simpan Urutan".</p>

    <div id="slideGrid" class="slide-grid"></div>
    <div id="emptyState" class="empty-state" style="display:none;">
      Belum ada konten untuk TV ini. Upload gambar atau video di atas untuk mulai.
    </div>
  </main>

<script>
  window.__DISPLAYS__ = <?= json_encode($displays, JSON_UNESCAPED_SLASHES) ?>;
  // Admin (internal-only) dan player (public) sekarang dua service/host
  // terpisah, jadi base URL player datang dari PLAYER_BASE_URL di config.php,
  // bukan diturunkan dari lokasi admin panel sendiri.
  window.__SIGNAGE_BASE_URL__ = <?= json_encode(rtrim(PLAYER_BASE_URL, '/') . '/index.html') ?>;
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js"></script>
<script src="script.js"></script>
</body>
</html>
