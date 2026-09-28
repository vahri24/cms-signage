<?php
require_once __DIR__ . '/auth.php';

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    if (attempt_login($username, $password)) {
        header('Location: index.php');
        exit;
    } else {
        $error = 'Username atau password salah.';
    }
}

if (is_logged_in()) {
    header('Location: index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login - Signage Admin</title>
<link rel="stylesheet" href="style.css">
</head>
<body class="login-body">
  <form class="login-card" method="POST" autocomplete="off">
    <img class="login-logo" src="assets/logo.png" alt="Logo">
    <h1>Signage Admin</h1>
    <p class="login-sub">Masuk untuk kelola konten TV</p>
    <?php if ($error): ?>
      <div class="alert alert-error"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>
    <label>
      Username
      <input type="text" name="username" required autofocus autocapitalize="off">
    </label>
    <label>
      Password
      <input type="password" name="password" required>
    </label>
    <button type="submit" class="btn btn-primary btn-block">Masuk</button>
  </form>
</body>
</html>
