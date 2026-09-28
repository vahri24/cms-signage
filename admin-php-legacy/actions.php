<?php
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json');

if (!is_logged_in()) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Belum login']);
    exit;
}

function read_config() {
    if (!file_exists(CONFIG_FILE)) return ['displays' => []];
    $data = json_decode(file_get_contents(CONFIG_FILE), true);
    if (!is_array($data) || !isset($data['displays'])) return ['displays' => []];
    return $data;
}

function write_config($data) {
    file_put_contents(CONFIG_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

function safe_filename($original) {
    $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
    $base = pathinfo($original, PATHINFO_FILENAME);
    $base = preg_replace('/[^a-zA-Z0-9_-]/', '-', $base);
    $unique = substr(md5(uniqid('', true)), 0, 6);
    return $base . '-' . $unique . '.' . $ext;
}

function file_used_elsewhere($config, $filename, $exceptDisplay) {
    foreach ($config['displays'] as $key => $display) {
        if ($key === $exceptDisplay) continue;
        foreach ($display['slides'] as $s) {
            if ($s['file'] === $filename) return true;
        }
    }
    return false;
}

function next_display_key($config) {
    $max = 0;
    foreach (array_keys($config['displays']) as $key) {
        if (preg_match('/^tv(\d+)$/', $key, $m)) {
            $max = max($max, (int) $m[1]);
        }
    }
    return 'tv' . ($max + 1);
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$displayId = $_POST['display'] ?? $_GET['display'] ?? '';

$config = read_config();

if (!empty($displayId) && !isset($config['displays'][$displayId])) {
    echo json_encode(['ok' => false, 'error' => 'Display tidak ditemukan: ' . $displayId]);
    exit;
}

switch ($action) {

    case 'upload':
        if (empty($displayId)) {
            echo json_encode(['ok' => false, 'error' => 'Display tujuan tidak disebutkan.']);
            exit;
        }
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            echo json_encode(['ok' => false, 'error' => 'Upload gagal atau tidak ada file.']);
            exit;
        }

        $file = $_FILES['file'];
        $sizeMb = $file['size'] / (1024 * 1024);
        if ($sizeMb > MAX_UPLOAD_MB) {
            echo json_encode(['ok' => false, 'error' => 'File terlalu besar. Maks ' . MAX_UPLOAD_MB . 'MB.']);
            exit;
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $isImage = in_array($ext, ALLOWED_IMAGE_EXT);
        $isVideo = in_array($ext, ALLOWED_VIDEO_EXT);

        if (!$isImage && !$isVideo) {
            echo json_encode(['ok' => false, 'error' => 'Tipe file tidak didukung: .' . $ext]);
            exit;
        }

        if (!is_dir(MEDIA_DIR)) mkdir(MEDIA_DIR, 0775, true);

        $newName = safe_filename($file['name']);
        $destPath = MEDIA_DIR . $newName;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            echo json_encode(['ok' => false, 'error' => 'Gagal menyimpan file ke server.']);
            exit;
        }

        $config['displays'][$displayId]['slides'][] = [
            'file' => $newName,
            'type' => $isVideo ? 'video' : 'image',
            'duration' => $isVideo ? DEFAULT_VIDEO_DURATION : DEFAULT_IMAGE_DURATION,
        ];
        write_config($config);
        audit_log('upload', ['display' => $displayId, 'file' => $newName]);

        echo json_encode(['ok' => true, 'slides' => $config['displays'][$displayId]['slides']]);
        break;

    case 'delete':
        if (empty($displayId)) {
            echo json_encode(['ok' => false, 'error' => 'Display tujuan tidak disebutkan.']);
            exit;
        }
        $filename = basename($_POST['file'] ?? '');
        if (!$filename) {
            echo json_encode(['ok' => false, 'error' => 'Nama file tidak valid.']);
            exit;
        }

        $config['displays'][$displayId]['slides'] = array_values(array_filter(
            $config['displays'][$displayId]['slides'],
            function ($s) use ($filename) { return $s['file'] !== $filename; }
        ));

        // Hanya hapus file fisik kalau tidak dipakai TV lain
        if (!file_used_elsewhere($config, $filename, $displayId)) {
            $path = MEDIA_DIR . $filename;
            if (file_exists($path)) unlink($path);
        }

        write_config($config);
        audit_log('delete', ['display' => $displayId, 'file' => $filename]);
        echo json_encode(['ok' => true, 'slides' => $config['displays'][$displayId]['slides']]);
        break;

    case 'save':
        if (empty($displayId)) {
            echo json_encode(['ok' => false, 'error' => 'Display tujuan tidak disebutkan.']);
            exit;
        }
        $raw = file_get_contents('php://input');
        $body = json_decode($raw, true);
        $slides = $body['slides'] ?? null;

        if (!is_array($slides)) {
            echo json_encode(['ok' => false, 'error' => 'Data tidak valid.']);
            exit;
        }

        $clean = [];
        foreach ($slides as $s) {
            if (!isset($s['file'], $s['type'])) continue;
            $clean[] = [
                'file' => basename($s['file']),
                'type' => $s['type'] === 'video' ? 'video' : 'image',
                'duration' => isset($s['duration']) ? (int) $s['duration'] : DEFAULT_IMAGE_DURATION,
            ];
        }

        $config['displays'][$displayId]['slides'] = $clean;
        write_config($config);
        audit_log('save_order', ['display' => $displayId, 'count' => count($clean)]);
        echo json_encode(['ok' => true, 'slides' => $clean]);
        break;

    case 'copy_to':
        // Salin satu slide (referensi file yang sama) dari satu TV ke TV lain
        $targetDisplay = $_POST['target'] ?? '';
        $filename = basename($_POST['file'] ?? '');
        if (empty($displayId) || empty($targetDisplay) || !isset($config['displays'][$targetDisplay])) {
            echo json_encode(['ok' => false, 'error' => 'Data tidak lengkap.']);
            exit;
        }
        $source = null;
        foreach ($config['displays'][$displayId]['slides'] as $s) {
            if ($s['file'] === $filename) { $source = $s; break; }
        }
        if (!$source) {
            echo json_encode(['ok' => false, 'error' => 'Konten tidak ditemukan.']);
            exit;
        }
        $config['displays'][$targetDisplay]['slides'][] = $source;
        write_config($config);
        audit_log('copy_to', ['display' => $displayId, 'target' => $targetDisplay, 'file' => $filename]);
        echo json_encode(['ok' => true, 'slides' => $config['displays'][$displayId]['slides']]);
        break;

    case 'add_display':
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            echo json_encode(['ok' => false, 'error' => 'Nama TV tidak boleh kosong.']);
            exit;
        }
        $key = next_display_key($config);
        $config['displays'][$key] = ['name' => $name, 'slides' => []];
        write_config($config);
        audit_log('add_display', ['display' => $key, 'name' => $name]);
        echo json_encode(['ok' => true, 'key' => $key, 'name' => $name]);
        break;

    case 'rename_display':
        $name = trim($_POST['name'] ?? '');
        if (empty($displayId) || $name === '') {
            echo json_encode(['ok' => false, 'error' => 'Data tidak lengkap.']);
            exit;
        }
        $oldName = $config['displays'][$displayId]['name'] ?? $displayId;
        $config['displays'][$displayId]['name'] = $name;
        write_config($config);
        audit_log('rename_display', ['display' => $displayId, 'old_name' => $oldName, 'new_name' => $name]);
        echo json_encode(['ok' => true, 'name' => $name]);
        break;

    case 'delete_display':
        if (empty($displayId)) {
            echo json_encode(['ok' => false, 'error' => 'Display tujuan tidak disebutkan.']);
            exit;
        }
        $name = $config['displays'][$displayId]['name'] ?? $displayId;
        foreach ($config['displays'][$displayId]['slides'] as $s) {
            if (!file_used_elsewhere($config, $s['file'], $displayId)) {
                $path = MEDIA_DIR . $s['file'];
                if (file_exists($path)) unlink($path);
            }
        }
        unset($config['displays'][$displayId]);
        write_config($config);
        audit_log('delete_display', ['display' => $displayId, 'name' => $name]);
        echo json_encode(['ok' => true]);
        break;

    default:
        echo json_encode(['ok' => false, 'error' => 'Aksi tidak dikenal.']);
}
