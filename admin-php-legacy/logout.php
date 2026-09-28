<?php
require_once __DIR__ . '/auth.php';
if (is_logged_in()) {
    audit_log('logout');
}
session_destroy();
header('Location: login.php');
exit;
