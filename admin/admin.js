(() => {
  const API = '../api';
  const loginView = document.getElementById('loginView');
  const adminView = document.getElementById('adminView');
  const passwordInput = document.getElementById('passwordInput');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');
  const uploadForm = document.getElementById('uploadForm');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadMsg = document.getElementById('uploadMsg');
  const fCategory = document.getElementById('fCategory');
  const adminCatFilters = document.getElementById('adminCatFilters');
  const adminList = document.getElementById('adminList');
  const dropzone = document.getElementById('dropzone');
  const fAudio = document.getElementById('fAudio');

  let allPrograms = [];
  let categories = [];
  let activeCategory = 'Todas';
  let editingId = null;

  async function checkSession() {
    const res = await fetch(`${API}/session_check.php`);
    const data = await res.json();
    if (data.logged_in) showAdmin(); else showLogin();
  }

  function showLogin() { loginView.hidden = false; adminView.hidden = true; }
  function showAdmin() { loginView.hidden = true; adminView.hidden = false; loadPrograms(); loadStats(); }

  async function loadStats() {
    const statCurrent = document.getElementById('statCurrent');
    const statPeak = document.getElementById('statPeak');
    const statsChart = document.getElementById('statsChart');
    const statsEmpty = document.getElementById('statsEmpty');
    try {
      const res = await fetch(`${API}/admin_stats.php`);
      const data = await res.json();
      statCurrent.textContent = data.current_listeners ?? '—';
      statPeak.textContent = data.peak_30d ?? '—';

      const series = data.series_24h || [];
      if (!series.length) {
        statsChart.innerHTML = '';
        statsEmpty.hidden = false;
        return;
      }
      statsEmpty.hidden = true;

      const maxVal = Math.max(1, ...series.map(p => p.max));
      const w = 300, h = 90, barGap = 2;
      const barW = (w / series.length) - barGap;
      const bars = series.map((p, i) => {
        const barH = Math.max(2, (p.max / maxVal) * (h - 4));
        const x = i * (barW + barGap);
        const y = h - barH;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="1.5" fill="#1db954" opacity="0.85"><title>${new Date(p.hour * 1000).toLocaleString('es-ES', { hour: '2-digit', day: '2-digit', month: '2-digit' })} — pico ${p.max}, media ${p.avg}</title></rect>`;
      }).join('');
      statsChart.innerHTML = bars;
    } catch (e) {
      // No bloqueamos el resto del panel si las estadísticas fallan
      statsEmpty.hidden = false;
    }
  }

  async function doLogin() {
    loginError.textContent = '';
    const password = passwordInput.value;
    if (!password) return;
    loginBtn.disabled = true;
    try {
      const res = await fetch(`${API}/login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) { passwordInput.value = ''; showAdmin(); }
      else loginError.textContent = data.error || 'Contraseña incorrecta';
    } catch (e) {
      loginError.textContent = 'Error de conexión';
    } finally {
      loginBtn.disabled = false;
    }
  }

  loginBtn.addEventListener('click', doLogin);
  passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

  logoutBtn.addEventListener('click', async () => {
    await fetch(`${API}/logout.php`, { method: 'POST' });
    showLogin();
  });

  function setDropzoneFile(file) {
    if (file) {
      dropzone.classList.add('has-file');
      dropzone.innerHTML = `<strong>🎵 ${escapeHtml(file.name)}</strong>${(file.size / 1024 / 1024).toFixed(1)} MB — toca para cambiar`;
    } else {
      dropzone.classList.remove('has-file');
      dropzone.innerHTML = `<strong>Arrastra aquí el MP3</strong>o toca para seleccionar un archivo`;
    }
  }

  // Evita que el navegador abra/descargue el archivo si el drop cae fuera
  // exacto de la zona (comportamiento por defecto del navegador).
  ['dragover', 'drop'].forEach(evt => {
    window.addEventListener(evt, (e) => e.preventDefault());
    document.addEventListener(evt, (e) => e.preventDefault());
  });

  dropzone.addEventListener('click', () => fAudio.click());

  fAudio.addEventListener('change', () => {
    setDropzoneFile(fAudio.files[0] || null);
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'dragend'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.mp3') && file.type !== 'audio/mpeg') {
      alert('Solo se admiten archivos MP3.');
      return;
    }
    fAudio.files = files;
    setDropzoneFile(file);
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    uploadMsg.textContent = '';
    uploadMsg.className = 'upload-msg';

    const fd = new FormData();
    fd.append('title', document.getElementById('fTitle').value.trim());
    fd.append('category', fCategory.value);
    fd.append('description', document.getElementById('fDescription').value.trim());
    const fileInput = document.getElementById('fAudio');
    if (!fileInput.files.length) return;
    fd.append('audio', fileInput.files[0]);

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Subiendo…';

    try {
      const res = await fetch(`${API}/upload.php`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        uploadMsg.textContent = '✅ Programa subido correctamente';
        uploadMsg.classList.add('ok');
        uploadForm.reset();
        loadPrograms();
      } else {
        uploadMsg.textContent = '❌ ' + (data.error || 'Error al subir');
        uploadMsg.classList.add('err');
      }
    } catch (err) {
      uploadMsg.textContent = '❌ Error de conexión';
      uploadMsg.classList.add('err');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Subir MP3';
    }
  });

  function fmtDuration(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function renderCategorySelect() {
    fCategory.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  function renderCategoryFilters() {
    const cats = ['Todas', ...categories];
    adminCatFilters.innerHTML = cats.map(c =>
      `<button class="chip ${c === activeCategory ? 'active' : ''}" data-cat="${c}">${c}</button>`
    ).join('');
    adminCatFilters.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        activeCategory = chip.dataset.cat;
        editingId = null;
        renderCategoryFilters();
        renderList();
      });
    });
  }

  function renderList() {
    const filtered = activeCategory === 'Todas'
      ? allPrograms
      : allPrograms.filter(p => (p.category || 'Otros') === activeCategory);

    if (filtered.length === 0) {
      adminList.innerHTML = '<p style="color:var(--text-muted); padding: 0 4px;">No hay programas en esta categoría.</p>';
      return;
    }

    adminList.innerHTML = filtered.map(p => {
      if (editingId === p.id) {
        return `
          <div class="admin-item" style="flex-direction:column; align-items:stretch;">
            <div class="edit-row">
              <input type="text" class="edit-title" value="${escapeAttr(p.title)}" placeholder="Título">
              <select class="edit-category">
                ${categories.map(c => `<option value="${c}" ${c === p.category ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
              <textarea class="edit-description" rows="2" placeholder="Descripción">${escapeHtml(p.description || '')}</textarea>
              <div class="edit-row-actions">
                <button class="btn-save" data-id="${p.id}">Guardar</button>
                <button class="btn-cancel" data-id="${p.id}">Cancelar</button>
              </div>
            </div>
          </div>`;
      }
      return `
        <div class="admin-item" data-id="${p.id}">
          <div class="admin-item-info">
            <div class="admin-item-title">${escapeHtml(p.title)}</div>
            <div class="admin-item-meta">${escapeHtml(p.category || 'Otros')} · ${fmtDuration(p.duration_seconds)}</div>
          </div>
          <div class="admin-item-actions">
            <button class="btn-edit" data-id="${p.id}">Editar</button>
            <button class="btn-delete" data-id="${p.id}">Eliminar</button>
          </div>
        </div>`;
    }).join('');

    adminList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteProgram(btn.dataset.id, btn));
    });
    adminList.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => { editingId = Number(btn.dataset.id); renderList(); });
    });
    adminList.querySelectorAll('.btn-cancel').forEach(btn => {
      btn.addEventListener('click', () => { editingId = null; renderList(); });
    });
    adminList.querySelectorAll('.btn-save').forEach(btn => {
      btn.addEventListener('click', () => saveProgram(Number(btn.dataset.id), btn));
    });
  }

  async function saveProgram(id, btn) {
    const row = btn.closest('.admin-item');
    const title = row.querySelector('.edit-title').value.trim();
    const category = row.querySelector('.edit-category').value;
    const description = row.querySelector('.edit-description').value.trim();

    if (!title) { alert('El título no puede estar vacío.'); return; }

    btn.disabled = true;
    try {
      const res = await fetch(`${API}/update.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title, category, description }),
      });
      if (res.ok) {
        editingId = null;
        loadPrograms();
      } else {
        const data = await res.json();
        alert('Error al guardar: ' + (data.error || ''));
        btn.disabled = false;
      }
    } catch (e) {
      alert('Error de conexión.');
      btn.disabled = false;
    }
  }

  async function deleteProgram(id, btn) {
    if (!confirm('¿Eliminar este programa? Esta acción no se puede deshacer.')) return;
    btn.disabled = true;
    try {
      const res = await fetch(`${API}/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id) }),
      });
      if (res.ok) loadPrograms();
      else { alert('No se pudo eliminar el programa.'); btn.disabled = false; }
    } catch (e) {
      alert('Error de conexión.');
      btn.disabled = false;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  async function loadPrograms() {
    try {
      const res = await fetch(`${API}/programs.php`);
      const data = await res.json();
      allPrograms = data.programs || [];
      categories = data.categories || [];
      renderCategorySelect();
      renderCategoryFilters();
      renderList();
    } catch (e) {
      adminList.innerHTML = '<p style="color:var(--text-muted);">Error al cargar programas.</p>';
    }
  }

  checkSession();
})();
