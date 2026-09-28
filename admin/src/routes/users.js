const express = require('express');
const bcrypt = require('bcryptjs');
const auth = require('../auth');
const store = require('../store');

const router = express.Router();

router.get('/users', auth.requireSuperadmin, (req, res) => {
  const users = store.loadUsers().users;
  res.render('users', {
    users,
    username: auth.currentUsername(req),
    role: auth.currentRole(req),
    error: '',
    success: '',
  });
});

router.post('/users', auth.requireSuperadmin, async (req, res) => {
  const data = store.loadUsers();
  const formAction = req.body.form_action || '';
  const currentUsername = auth.currentUsername(req);

  let error = '';
  let success = '';

  if (formAction === 'create') {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    const role = req.body.role === 'superadmin' ? 'superadmin' : 'editor';
    const exists = data.users.some((u) => u.username === username);

    if (username === '' || password.length < 6) {
      error = 'Username wajib diisi dan password minimal 6 karakter.';
    } else if (exists) {
      error = 'Username sudah dipakai.';
    } else {
      data.users.push({
        username,
        password_hash: bcrypt.hashSync(password, 10),
        role,
        disabled: false,
        created_at: new Date().toISOString(),
      });
      await store.saveUsers(data);
      await store.auditLog('create_user', { target_username: username, role }, currentUsername);
      success = `User "${username}" dibuat.`;
    }
  } else if (formAction === 'toggle') {
    const username = req.body.username || '';
    if (username === currentUsername) {
      error = 'Tidak bisa menonaktifkan akun sendiri.';
    } else {
      const target = data.users.find((u) => u.username === username);
      if (!target) {
        error = 'User tidak ditemukan.';
      } else {
        target.disabled = !target.disabled;
        await store.saveUsers(data);
        await store.auditLog('update_user', { target_username: username, disabled: target.disabled }, currentUsername);
        success = 'Status user diperbarui.';
      }
    }
  } else if (formAction === 'delete') {
    const username = req.body.username || '';
    const target = data.users.find((u) => u.username === username);
    const remainingSuperadmins = data.users.filter(
      (u) => u.role === 'superadmin' && u.username !== username && !u.disabled
    ).length;

    if (username === currentUsername) {
      error = 'Tidak bisa menghapus akun sendiri.';
    } else if (!target) {
      error = 'User tidak ditemukan.';
    } else if (target.role === 'superadmin' && remainingSuperadmins === 0) {
      error = 'Tidak bisa menghapus satu-satunya superadmin aktif.';
    } else {
      data.users = data.users.filter((u) => u.username !== username);
      await store.saveUsers(data);
      await store.auditLog('delete_user', { target_username: username }, currentUsername);
      success = `User "${username}" dihapus.`;
    }
  }

  const users = store.loadUsers().users;
  res.render('users', {
    users,
    username: auth.currentUsername(req),
    role: auth.currentRole(req),
    error,
    success,
  });
});

module.exports = router;
