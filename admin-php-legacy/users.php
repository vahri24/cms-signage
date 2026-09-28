<?php
require_once __DIR__ . '/auth.php';
require_superadmin();

$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = load_users();
    $formAction = $_POST['form_action'] ?? '';

    if ($formAction === 'create') {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $role = ($_POST['role'] ?? '') === 'superadmin' ? 'superadmin' : 'editor';

        $exists = false;
        foreach ($data['users'] as $u) {
            if ($u['username'] === $username) $exists = true;
        }

        if ($username === '' || strlen($password) < 6) {
            $error = 'Username wajib diisi dan password minimal 6 karakter.';
        } elseif ($exists) {
            $error = 'Username sudah dipakai.';
        } else {
            $data['users'][] = [
                'username' => $username,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'role' => $role,
                'disabled' => false,
                'created_at' => date('c'),
            ];
            save_users($data);
            audit_log('create_user', ['target_username' => $username, 'role' => $role]);
            $success = "User \"$username\" dibuat.";
        }
    } elseif ($formAction === 'toggle') {
        $username = $_POST['username'] ?? '';
        if ($username === current_username()) {
            $error = 'Tidak bisa menonaktifkan akun sendiri.';
        } else {
            $found = false;
            foreach ($data['users'] as &$u) {
                if ($u['username'] === $username) {
                    $u['disabled'] = !($u['disabled'] ?? false);
                    $found = true;
                    audit_log('update_user', ['target_username' => $username, 'disabled' => $u['disabled']]);
                    break;
                }
            }
            unset($u);
            if ($found) {
                save_users($data);
                $success = 'Status user diperbarui.';
            } else {
                $error = 'User tidak ditemukan.';
            }
        }
    } elseif ($formAction === 'delete') {
        $username = $_POST['username'] ?? '';
        $target = null;
        foreach ($data['users'] as $u) {
            if ($u['username'] === $username) $target = $u;
        }
        $remainingSuperadmins = count(array_filter(
            $data['users'],
            fn($u) => $u['role'] === 'superadmin' && $u['username'] !== $username && empty($u['disabled'])
        ));

        if ($username === current_username()) {
            $error = 'Tidak bisa menghapus akun sendiri.';
        } elseif (!$target) {
            $error = 'User tidak ditemukan.';
        } elseif ($target['role'] === 'superadmin' && $remainingSuperadmins === 0) {
            $error = 'Tidak bisa menghapus satu-satunya superadmin aktif.';
        } else {
            $data['users'] = array_values(array_filter($data['users'], fn($u) => $u['username'] !== $username));
            save_users($data);
            audit_log('delete_user', ['target_username' => $username]);
            $success = "User \"$username\" dihapus.";
        }
    }
}

$users = load_users()['users'];
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Signage Admin - Kelola User</title>
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
      <a href="audit.php" class="btn btn-ghost">Audit Trail</a>
      <span class="user-badge"><?= htmlspecialchars(current_username()) ?> · <?= htmlspecialchars(current_role()) ?></span>
      <a href="logout.php" class="btn btn-ghost">Keluar</a>
    </div>
  </header>

  <main class="main">
    <h2>Kelola User</h2>
    <p class="hint-text">Superadmin bisa membuat akun, mengubah role, menonaktifkan, atau menghapus akun lain. Setiap perubahan tercatat di <a href="audit.php">Audit Trail</a>.</p>

    <?php if ($error): ?><div class="alert alert-error"><?= htmlspecialchars($error) ?></div><?php endif; ?>
    <?php if ($success): ?><div class="alert alert-ok"><?= htmlspecialchars($success) ?></div><?php endif; ?>

    <section class="panel-box">
      <h3>Tambah User Baru</h3>
      <form method="POST" class="inline-form">
        <input type="hidden" name="form_action" value="create">
        <label>Username <input type="text" name="username" required autocapitalize="off"></label>
        <label>Password <input type="password" name="password" required minlength="6"></label>
        <label>Role
          <select name="role">
            <option value="editor">Editor (kelola konten saja)</option>
            <option value="superadmin">Superadmin (kelola user juga)</option>
          </select>
        </label>
        <button type="submit" class="btn btn-primary">Tambah</button>
      </form>
    </section>

    <table class="data-table">
      <thead>
        <tr><th>Username</th><th>Role</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr>
      </thead>
      <tbody>
        <?php foreach ($users as $u): ?>
          <tr>
            <td><?= htmlspecialchars($u['username']) ?></td>
            <td><?= htmlspecialchars($u['role']) ?></td>
            <td><?= !empty($u['disabled']) ? '<span class="status-err">Nonaktif</span>' : '<span class="status-ok">Aktif</span>' ?></td>
            <td><?= htmlspecialchars($u['created_at'] ?? '-') ?></td>
            <td class="table-actions">
              <?php if ($u['username'] !== current_username()): ?>
                <form method="POST" class="inline-form-tight">
                  <input type="hidden" name="form_action" value="toggle">
                  <input type="hidden" name="username" value="<?= htmlspecialchars($u['username']) ?>">
                  <button type="submit" class="btn btn-ghost btn-copy"><?= !empty($u['disabled']) ? 'Aktifkan' : 'Nonaktifkan' ?></button>
                </form>
                <form method="POST" class="inline-form-tight" onsubmit="return confirm('Hapus user ini secara permanen?');">
                  <input type="hidden" name="form_action" value="delete">
                  <input type="hidden" name="username" value="<?= htmlspecialchars($u['username']) ?>">
                  <button type="submit" class="btn btn-danger-outline">Hapus</button>
                </form>
              <?php else: ?>
                <span class="hint-text">(akun kamu)</span>
              <?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </main>
</body>
</html>
