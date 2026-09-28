// State: konten per group item (TV atau Area), diisi dari server saat load awal.
// Dipakai bersama oleh index.ejs (group=displays) dan areas.ejs (group=areas).
const GROUP = window.__GROUP__ || 'displays';
const GROUP_LABEL = window.__GROUP_LABEL__ || 'TV';
const groupData = window.__GROUP_DATA__ || {};
const groupKeys = Object.keys(groupData);
let currentDisplay = groupKeys[0] || '';

const grid = document.getElementById('slideGrid');
const emptyState = document.getElementById('emptyState');
const slideCount = document.getElementById('slideCount');
const saveBtn = document.getElementById('saveOrderBtn');
const uploadStatus = document.getElementById('uploadStatus');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const tvTabs = document.getElementById('tvTabs');
// Only present on index.ejs (TV) - areas.ejs has no Fully Kiosk link, since
// Areas are consumed through the device API, not a browser URL.
const tvLinkDisplay = document.getElementById('tvLinkDisplay');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const previewLink = document.getElementById('previewLink');

let sortableInstance = null;

function getSlides() {
  return (groupData[currentDisplay] && groupData[currentDisplay].slides) || [];
}

function setSlides(newSlides) {
  groupData[currentDisplay].slides = newSlides;
}

function updateTvLink() {
  if (!tvLinkDisplay) return;
  const url = `${window.__SIGNAGE_BASE_URL__}?tv=${currentDisplay}`;
  tvLinkDisplay.textContent = url;
  previewLink.href = url;
}

function switchTab(displayKey) {
  currentDisplay = displayKey;
  [...tvTabs.children].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.display === displayKey);
  });
  updateTvLink();
  render();
  uploadStatus.textContent = '';
}

tvTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.tv-tab');
  if (btn && btn.dataset.display) switchTab(btn.dataset.display);
});

document.getElementById('addTvBtn').addEventListener('click', async () => {
  const name = prompt(`Nama ${GROUP_LABEL} baru:`);
  if (!name) return;
  try {
    const res = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `action=add_display&group=${GROUP}&name=` + encodeURIComponent(name)
    });
    const data = await res.json();
    if (data.ok) {
      location.reload();
    } else {
      showStatus(data.error || `Gagal menambah ${GROUP_LABEL}.`, 'err');
    }
  } catch (e) {
    showStatus('Gagal terhubung ke server.', 'err');
  }
});

document.getElementById('renameTvBtn').addEventListener('click', async () => {
  const current = (groupData[currentDisplay] && groupData[currentDisplay].name) || currentDisplay;
  const name = prompt(`Nama baru untuk ${GROUP_LABEL} ini:`, current);
  if (!name || name === current) return;
  try {
    const res = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `action=rename_display&group=${GROUP}&display=${currentDisplay}&name=` + encodeURIComponent(name)
    });
    const data = await res.json();
    if (data.ok) {
      location.reload();
    } else {
      showStatus(data.error || 'Gagal mengubah nama.', 'err');
    }
  } catch (e) {
    showStatus('Gagal terhubung ke server.', 'err');
  }
});

document.getElementById('deleteTvBtn').addEventListener('click', async () => {
  const warning = tvLinkDisplay ? ' Link TV ini akan berhenti berfungsi.' : '';
  if (!confirm(`Hapus ${GROUP_LABEL} "${currentDisplay.toUpperCase()}" beserta seluruh kontennya?${warning}`)) return;
  try {
    const res = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `action=delete_display&group=${GROUP}&display=${currentDisplay}`
    });
    const data = await res.json();
    if (data.ok) {
      location.reload();
    } else {
      showStatus(data.error || `Gagal menghapus ${GROUP_LABEL}.`, 'err');
    }
  } catch (e) {
    showStatus('Gagal terhubung ke server.', 'err');
  }
});

if (copyLinkBtn) {
  const copyLinkIdle = copyLinkBtn.innerHTML;
  copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(tvLinkDisplay.textContent).then(() => {
      copyLinkBtn.innerHTML = '<svg class="icon"><use href="#icon-check-circle"/></svg> Tersalin!';
      setTimeout(() => (copyLinkBtn.innerHTML = copyLinkIdle), 1500);
    });
  });
}

function render() {
  const slides = getSlides();
  grid.innerHTML = '';
  emptyState.style.display = slides.length ? 'none' : 'flex';
  slideCount.textContent = slides.length ? `(${slides.length})` : '';

  slides.forEach((slide, i) => {
    const card = document.createElement('div');
    card.className = 'slide-card';
    card.dataset.file = slide.file;
    card.style.setProperty('--i', i);

    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    if (slide.type === 'video') {
      const video = document.createElement('video');
      video.src = '/media/' + slide.file;
      video.muted = true;
      thumb.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = '/media/' + slide.file;
      thumb.appendChild(img);
    }

    const typeBadge = document.createElement('span');
    typeBadge.className = 'type-badge';
    const badgeIcon = slide.type === 'video' ? 'icon-video' : 'icon-image';
    typeBadge.innerHTML = `<svg class="icon"><use href="#${badgeIcon}"/></svg>${slide.type === 'video' ? 'Video' : 'Gambar'}`;
    thumb.appendChild(typeBadge);

    const orderBadge = document.createElement('span');
    orderBadge.className = 'order-badge';
    orderBadge.textContent = i + 1;
    thumb.appendChild(orderBadge);

    const info = document.createElement('div');
    info.className = 'info';

    const filename = document.createElement('div');
    filename.className = 'slide-filename';
    filename.textContent = slide.file;
    info.appendChild(filename);

    const durationRow = document.createElement('div');
    durationRow.className = 'duration-row';

    if (slide.type === 'image') {
      durationRow.innerHTML = `
        <label>Durasi:</label>
        <input type="number" min="1" max="120" value="${slide.duration || 8}" data-index="${i}" class="duration-input">
        <span>detik</span>
      `;
    } else {
      durationRow.innerHTML = `<span style="color:var(--text-dim)">Putar sampai video selesai</span>`;
    }
    info.appendChild(durationRow);

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger-outline';
    delBtn.innerHTML = '<svg class="icon"><use href="#icon-trash"/></svg> Hapus';
    delBtn.onclick = () => deleteSlide(slide.file);
    actions.appendChild(delBtn);
    info.appendChild(actions);

    card.appendChild(thumb);
    card.appendChild(info);
    grid.appendChild(card);
  });

  grid.querySelectorAll('.duration-input').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      const slides = getSlides();
      slides[idx].duration = parseInt(e.target.value, 10) || 8;
      markDirty();
    });
  });

  if (sortableInstance) sortableInstance.destroy();
  sortableInstance = new Sortable(grid, {
    animation: 150,
    onEnd: () => {
      const newOrderFiles = [...grid.children].map(c => c.dataset.file);
      const slides = getSlides();
      slides.sort((a, b) => newOrderFiles.indexOf(a.file) - newOrderFiles.indexOf(b.file));
      render();
      markDirty();
    }
  });
}

function markDirty() {
  saveBtn.disabled = false;
}

const SAVE_BTN_IDLE = '<svg class="icon"><use href="#icon-save"/></svg> Simpan Urutan';
const SAVE_BTN_BUSY = '<svg class="icon icon-spin"><use href="#icon-spinner"/></svg> Menyimpan...';

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  saveBtn.innerHTML = SAVE_BTN_BUSY;
  try {
    const res = await fetch(`/api/actions?action=save&group=${GROUP}&display=${currentDisplay}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slides: getSlides() })
    });
    const data = await res.json();
    if (data.ok) {
      showStatus('Urutan dan durasi tersimpan.', 'ok');
    } else {
      showStatus(data.error || 'Gagal menyimpan.', 'err');
      saveBtn.disabled = false;
    }
  } catch (e) {
    showStatus('Gagal terhubung ke server.', 'err');
    saveBtn.disabled = false;
  }
  saveBtn.innerHTML = SAVE_BTN_IDLE;
});

async function deleteSlide(filename) {
  if (!confirm(`Hapus konten ini dari ${GROUP_LABEL} ini?`)) return;
  try {
    const res = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `action=delete&group=${GROUP}&display=${currentDisplay}&file=` + encodeURIComponent(filename)
    });
    const data = await res.json();
    if (data.ok) {
      setSlides(data.slides);
      render();
      showStatus('Konten dihapus.', 'ok');
    } else {
      showStatus(data.error || 'Gagal menghapus.', 'err');
    }
  } catch (e) {
    showStatus('Gagal terhubung ke server.', 'err');
  }
}

async function uploadFiles(fileList) {
  for (const file of fileList) {
    showStatus(`Mengunggah ${file.name}...`, 'progress');
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('group', GROUP);
    formData.append('display', currentDisplay);
    formData.append('file', file);
    try {
      const res = await fetch('/api/actions', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) {
        setSlides(data.slides);
        render();
        showStatus(`${file.name} berhasil diunggah ke ${currentDisplay.toUpperCase()}.`, 'ok');
      } else {
        showStatus(`${file.name}: ${data.error}`, 'err');
      }
    } catch (e) {
      showStatus(`${file.name}: gagal terhubung ke server.`, 'err');
    }
  }
}

const STATUS_ICON = { ok: 'icon-check-circle', err: 'icon-alert-circle', progress: 'icon-spinner' };
let statusHideTimer = null;

function showStatus(msg, type) {
  clearTimeout(statusHideTimer);
  const iconName = STATUS_ICON[type] || 'icon-info';
  const spin = type === 'progress' ? ' icon-spin' : '';
  uploadStatus.innerHTML = `<svg class="icon toast-icon${spin}"><use href="#${iconName}"/></svg><span>${msg}</span>`;
  uploadStatus.className = 'status-' + type;
  // Force reflow so the enter transition replays even if a toast is already visible.
  void uploadStatus.offsetWidth;
  uploadStatus.classList.add('visible');
  if (type === 'ok') {
    statusHideTimer = setTimeout(() => uploadStatus.classList.remove('visible'), 4000);
  }
}

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) uploadFiles(e.target.files);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});
dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
});

// Init - safe even with zero items (groupData[''] is undefined, getSlides()
// falls back to [], so the empty-state message still shows correctly).
switchTab(currentDisplay);
