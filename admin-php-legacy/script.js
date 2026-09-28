// State: konten per display, diisi dari PHP saat load awal
const displaysData = window.__DISPLAYS__ || {};
const displayKeys = Object.keys(displaysData);
let currentDisplay = displayKeys[0] || 'tv1';

const grid = document.getElementById('slideGrid');
const emptyState = document.getElementById('emptyState');
const slideCount = document.getElementById('slideCount');
const saveBtn = document.getElementById('saveOrderBtn');
const uploadStatus = document.getElementById('uploadStatus');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const tvTabs = document.getElementById('tvTabs');
const tvLinkDisplay = document.getElementById('tvLinkDisplay');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const previewLink = document.getElementById('previewLink');

let sortableInstance = null;

function getSlides() {
  return (displaysData[currentDisplay] && displaysData[currentDisplay].slides) || [];
}

function setSlides(newSlides) {
  displaysData[currentDisplay].slides = newSlides;
}

function updateTvLink() {
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
  const name = prompt('Nama TV baru (contoh: TV 6 - Lobby):');
  if (!name) return;
  try {
    const res = await fetch('actions.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'action=add_display&name=' + encodeURIComponent(name)
    });
    const data = await res.json();
    if (data.ok) {
      location.reload();
    } else {
      showStatus(data.error || 'Gagal menambah TV.', 'err');
    }
  } catch (e) {
    showStatus('Gagal terhubung ke server.', 'err');
  }
});

document.getElementById('renameTvBtn').addEventListener('click', async () => {
  const current = (displaysData[currentDisplay] && displaysData[currentDisplay].name) || currentDisplay;
  const name = prompt('Nama baru untuk TV ini:', current);
  if (!name || name === current) return;
  try {
    const res = await fetch('actions.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `action=rename_display&display=${currentDisplay}&name=` + encodeURIComponent(name)
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
  if (!confirm(`Hapus TV "${currentDisplay.toUpperCase()}" beserta seluruh kontennya? Link TV ini akan berhenti berfungsi.`)) return;
  try {
    const res = await fetch('actions.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `action=delete_display&display=${currentDisplay}`
    });
    const data = await res.json();
    if (data.ok) {
      location.reload();
    } else {
      showStatus(data.error || 'Gagal menghapus TV.', 'err');
    }
  } catch (e) {
    showStatus('Gagal terhubung ke server.', 'err');
  }
});

copyLinkBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(tvLinkDisplay.textContent).then(() => {
    copyLinkBtn.textContent = 'Tersalin!';
    setTimeout(() => (copyLinkBtn.textContent = 'Salin Link'), 1500);
  });
});

function render() {
  const slides = getSlides();
  grid.innerHTML = '';
  emptyState.style.display = slides.length ? 'none' : 'block';
  slideCount.textContent = slides.length ? `(${slides.length})` : '';

  slides.forEach((slide, i) => {
    const card = document.createElement('div');
    card.className = 'slide-card';
    card.dataset.file = slide.file;

    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    if (slide.type === 'video') {
      const video = document.createElement('video');
      video.src = '../media/' + slide.file;
      video.muted = true;
      thumb.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = '../media/' + slide.file;
      thumb.appendChild(img);
    }

    const typeBadge = document.createElement('span');
    typeBadge.className = 'type-badge';
    typeBadge.textContent = slide.type === 'video' ? 'Video' : 'Gambar';
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
    delBtn.textContent = 'Hapus';
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

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  saveBtn.textContent = 'Menyimpan...';
  try {
    const res = await fetch(`actions.php?action=save&display=${currentDisplay}`, {
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
  saveBtn.textContent = 'Simpan Urutan';
});

async function deleteSlide(filename) {
  if (!confirm('Hapus konten ini dari TV ini?')) return;
  try {
    const res = await fetch('actions.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `action=delete&display=${currentDisplay}&file=` + encodeURIComponent(filename)
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
    formData.append('display', currentDisplay);
    formData.append('file', file);
    try {
      const res = await fetch('actions.php', { method: 'POST', body: formData });
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

function showStatus(msg, type) {
  uploadStatus.textContent = msg;
  uploadStatus.className = 'status-' + type;
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

// Init
switchTab(currentDisplay);
