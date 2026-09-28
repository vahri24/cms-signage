<?php
require_once __DIR__ . '/auth.php';
require_login();

$entries = [];
if (file_exists(AUDIT_LOG_FILE)) {
    $lines = file(AUDIT_LOG_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $lines = array_slice($lines, -500);
    foreach (array_reverse($lines) as $line) {
        $e = json_decode($line, true);
        if (is_array($e)) $entries[] = $e;
    }
}

function detail_text($entry) {
    $skip = ['ts', 'user', 'action'];
    $parts = [];
    foreach ($entry as $k => $v) {
        if (in_array($k, $skip, true)) continue;
        $parts[] = $k . '=' . (is_bool($v) ? ($v ? 'true' : 'false') : $v);
    }
    return implode(', ', $parts);
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Signage Admin - Audit Trail</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="topbar">
    <div class="topbar-title">
      <img class="logo" src="assets/logo.png" alt="Logo">
      <span>Signage Admin</span>
    </div>
    <div class="topbar-actions">
      <a href="index.php" class="btn btn-ghost">Kelola Konten</a>
      <?php if (is_superadmin()): ?><a href="users.php" class="btn btn-ghost">Users</a><?php endif; ?>
      <span class="user-badge"><?= htmlspecialchars(current_username()) ?> · <?= htmlspecialchars(current_role()) ?></span>
      <a href="logout.php" class="btn btn-ghost">Keluar</a>
    </div>
  </header>

  <main class="main">
    <h2>Audit Trail</h2>
    <p class="hint-text">Riwayat 500 aktivitas terakhir: login, upload, hapus konten, dan perubahan TV/user. Terbaru di atas.</p>

    <table class="data-table">
      <thead>
        <tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Detail</th></tr>
      </thead>
      <tbody>
        <?php if (!$entries): ?>
          <tr><td colspan="4" class="empty-state">Belum ada aktivitas tercatat.</td></tr>
        <?php endif; ?>
        <?php foreach ($entries as $e): ?>
          <tr>
            <td><?= htmlspecialchars($e['ts'] ?? '-') ?></td>
            <td><?= htmlspecialchars($e['user'] ?? '-') ?></td>
            <td><?= htmlspecialchars($e['action'] ?? '-') ?></td>
            <td class="slide-filename" style="white-space:normal;"><?= htmlspecialchars(detail_text($e)) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </main>
</body>
</html>
