<?php
session_start();
require_once __DIR__ . '/config.php';

function load_users() {
    if (!file_exists(USERS_FILE)) {
        if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0775, true);
        $seed = [
            'users' => [[
                'username' => BOOTSTRAP_ADMIN_USERNAME,
                'password_hash' => BOOTSTRAP_ADMIN_PASSWORD_HASH,
                'role' => 'superadmin',
                'disabled' => false,
                'created_at' => date('c'),
            ]],
        ];
        file_put_contents(USERS_FILE, json_encode($seed, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        return $seed;
    }
    $data = json_decode(file_get_contents(USERS_FILE), true);
    if (!is_array($data) || !isset($data['users'])) return ['users' => []];
    return $data;
}

function save_users($data) {
    file_put_contents(USERS_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function audit_log($action, $details = [], $user = null) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0775, true);
    $user = $user ?? ($_SESSION['signage_admin_user'] ?? 'unknown');
    $entry = array_merge([
        'ts' => date('c'),
        'user' => $user,
        'action' => $action,
    ], $details);
    file_put_contents(AUDIT_LOG_FILE, json_encode($entry, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}

function attempt_login($username, $password) {
    $data = load_users();
    foreach ($data['users'] as $u) {
        if ($u['username'] === $username) {
            if (!empty($u['disabled'])) {
                audit_log('login_failed', ['reason' => 'disabled'], $username);
                return false;
            }
            if (password_verify($password, $u['password_hash'])) {
                $_SESSION['signage_admin'] = true;
                $_SESSION['signage_admin_user'] = $username;
                $_SESSION['signage_admin_role'] = $u['role'];
                audit_log('login');
                return true;
            }
            break;
        }
    }
    audit_log('login_failed', [], $username);
    return false;
}

function is_logged_in() {
    return isset($_SESSION['signage_admin']) && $_SESSION['signage_admin'] === true;
}

function current_username() {
    return $_SESSION['signage_admin_user'] ?? null;
}

function current_role() {
    return $_SESSION['signage_admin_role'] ?? null;
}

function is_superadmin() {
    return current_role() === 'superadmin';
}

function require_login() {
    if (!is_logged_in()) {
        header('Location: login.php');
        exit;
    }
}

function require_superadmin() {
    require_login();
    if (!is_superadmin()) {
        http_response_code(403);
        echo 'Akses ditolak. Hanya superadmin yang bisa mengakses halaman ini.';
        exit;
    }
}
