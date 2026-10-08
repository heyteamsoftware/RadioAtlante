(() => {
  const API_BASE = 'api';
  const audio = document.getElementById('audioPlayer');
  const playerBar = document.getElementById('playerBar');
  const playerTitle = document.getElementById('playerTitle');
  const playerSubtitle = document.getElementById('playerSubtitle');
  const playerCover = document.getElementById('playerCover');
  const playerToggle = document.getElementById('playerToggle');
  const iconPlay = document.getElementById('iconPlay');
  const iconPause = document.getElementById('iconPause');
  const seekBar = document.getElementById('seekBar');
  const timeCurrent = document.getElementById('timeCurrent');
  const timeDuration = document.getElementById('timeDuration');
  const btnLive = document.getElementById('btnLive');
  const btnLiveIconPlay = document.getElementById('btnLiveIconPlay');
  const btnLiveIconPause = document.getElementById('btnLiveIconPause');
  const btnLiveSpinner = document.getElementById('btnLiveSpinner');
  const btnLiveLabel = document.getElementById('btnLiveLabel');
  const liveBadge = document.getElementById('liveBadge');
  const liveListeners = document.getElementById('liveListeners');
  const liveNowPlaying = document.getElementById('liveNowPlaying');
  const liveNowPlayingTitle = document.getElementById('liveNowPlayingTitle');
  const liveNowPlayingTime = document.getElementById('liveNowPlayingTime');
  const liveNowPlayingCover = document.getElementById('liveNowPlayingCover');
  const programsGrid = document.getElementById('programsGrid');
  const categoryFilters = document.getElementById('categoryFilters');
  const searchInput = document.getElementById('searchInput');

  let programs = [];
  let categories = [];
  let currentMode = null; // 'live' | 'program'
  let currentProgram = null;
  let activeCategory = 'Todos';
  let isSeeking = false;
  let liveNowPlayingText = null;
  let liveNowPlayingCoverUrl = null;

  // Algunos navegadores no reflejan correctamente la propiedad `.hidden` en
  // elementos SVG (sí en HTML normal), así que forzamos el atributo a mano.
  function setHidden(el, hide) {
    if (hide) el.setAttribute('hidden', '');
    else el.removeAttribute('hidden');
  }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateMediaSession(title, artist, artwork) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title, artist,
      album: 'Radio Atlante',
      artwork: artwork ? [{ src: artwork, sizes: '512x512', type: 'image/png' }] : [],
    });
    navigator.mediaSession.setActionHandler('play', () => { audio.play(); });
    navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); });
    navigator.mediaSession.setActionHandler('stop', () => { audio.pause(); });
    // En directo no tiene sentido avanzar/retroceder ni seek
    if (currentMode === 'program') {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) audio.currentTime = details.seekTime;
      });
    } else {
      navigator.mediaSession.setActionHandler('seekto', null);
    }
  }

  function setLiveButtonState(state) {
    // state: 'idle' | 'loading' | 'playing'
    btnLive.classList.toggle('loading', state === 'loading');
    setHidden(btnLiveIconPlay, state !== 'idle');
    setHidden(btnLiveSpinner, state !== 'loading');
    setHidden(btnLiveIconPause, state !== 'playing');
    btnLiveLabel.textContent = state === 'loading'
      ? 'Conectando…'
      : state === 'playing'
        ? 'Sonando ahora'
        : 'Escuchar emisión';
  }

  function playLive() {
    currentMode = 'live';
    currentProgram = null;
    setLiveButtonState('loading');
    audio.src = window.__LIVE_STREAM_URL__ || 'stream';
    audio.play().catch(() => { setLiveButtonState('idle'); });
    setHidden(playerBar, false);
    playerBar.classList.add('live-mode');
    playerTitle.textContent = liveNowPlayingText || 'En directo';
    playerSubtitle.textContent = 'Radio Atlante — 24h';
    playerCover.src = liveNowPlayingCoverUrl || 'assets/img/default-cover.svg';
    updateMediaSession(liveNowPlayingText || 'Radio Atlante en directo', 'En directo · 24h', liveNowPlayingCoverUrl);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    highlightPlayingCard(null);
  }

  function playProgram(program) {
    currentMode = 'program';
    currentProgram = program;
    setLiveButtonState('idle');
    audio.src = program.stream_url;
    audio.play().catch(() => {});
    setHidden(playerBar, false);
    playerBar.classList.remove('live-mode');
    playerTitle.textContent = program.title;
    playerSubtitle.textContent = program.category || 'Programa';
    playerCover.src = program.cover_url || 'assets/img/default-cover.svg';
    updateMediaSession(program.title, program.category || 'Radio Atlante', program.cover_url);
    highlightPlayingCard(program.id);
  }

  function highlightPlayingCard(id) {
    document.querySelectorAll('.program-row').forEach(el => {
      el.classList.toggle('playing', String(el.dataset.id) === String(id));
    });
  }

  playerToggle.addEventListener('click', () => {
    if (audio.paused) audio.play(); else audio.pause();
  });

  audio.addEventListener('play', () => {
    setHidden(iconPlay, true); setHidden(iconPause, false);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    if (currentMode === 'live') setLiveButtonState('loading');
  });
  audio.addEventListener('playing', () => {
    if (currentMode === 'live') setLiveButtonState('playing');
  });
  audio.addEventListener('waiting', () => {
    if (currentMode === 'live') setLiveButtonState('loading');
  });
  audio.addEventListener('pause', () => {
    setHidden(iconPlay, false); setHidden(iconPause, true);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    if (currentMode === 'live') setLiveButtonState('idle');
  });

  audio.addEventListener('timeupdate', () => {
    if (currentMode !== 'program' || isSeeking) return;
    timeCurrent.textContent = fmtTime(audio.currentTime);
    timeDuration.textContent = fmtTime(audio.duration);
    if (isFinite(audio.duration) && audio.duration > 0) {
      seekBar.value = (audio.currentTime / audio.duration) * 100;
    }
  });

  seekBar.addEventListener('input', () => { isSeeking = true; });
  seekBar.addEventListener('change', () => {
    if (currentMode === 'program' && isFinite(audio.duration)) {
      audio.currentTime = (seekBar.value / 100) * audio.duration;
    }
    isSeeking = false;
  });

  btnLive.addEventListener('click', () => {
    if (currentMode === 'live' && !audio.paused) {
      audio.pause();
    } else {
      playLive();
    }
  });

  // Evitar que el navegador pause el audio al bloquear pantalla / cambiar pestaña.
  // (El <audio> HTML5 sigue sonando en background; no hacemos pause en visibilitychange.)
  document.addEventListener('visibilitychange', () => { /* intencionalmente vacío */ });

  async function loadLiveStatus() {
    try {
      const res = await fetch(`${API_BASE}/live_status.php`);
      const data = await res.json();
      window.__LIVE_STREAM_URL__ = data.stream_url;

      if (data.live) {
        liveListeners.textContent = `${data.listeners} oyente${data.listeners === 1 ? '' : 's'} conectados ahora`;
      } else {
        liveListeners.textContent = 'Preparando emisión…';
      }

      liveNowPlayingText = data.now_playing || null;
      liveNowPlayingCoverUrl = data.now_playing_cover || null;
      if (liveNowPlayingText) {
        liveNowPlayingTitle.textContent = liveNowPlayingText;
        liveNowPlayingCover.src = liveNowPlayingCoverUrl || 'assets/img/default-cover.svg';
        if (data.elapsed_seconds != null) {
          const total = data.duration_seconds
            ? ` / ${fmtTime(data.duration_seconds)}`
            : '';
          liveNowPlayingTime.textContent = `(${fmtTime(data.elapsed_seconds)}${total})`;
        } else {
          liveNowPlayingTime.textContent = '';
        }
        setHidden(liveNowPlaying, false);
      } else {
        setHidden(liveNowPlaying, true);
      }

      // Si ya estamos escuchando el directo, refrescamos también el título
      // y la portada en el reproductor persistente y en la pantalla de bloqueo.
      if (currentMode === 'live') {
        playerTitle.textContent = liveNowPlayingText || 'En directo';
        playerCover.src = liveNowPlayingCoverUrl || 'assets/img/default-cover.svg';
        updateMediaSession(liveNowPlayingText || 'Radio Atlante en directo', 'En directo · 24h', liveNowPlayingCoverUrl);
      }
    } catch (e) {
      liveListeners.textContent = 'No se pudo conectar con el directo';
    }
  }

  function renderCategories() {
    const cats = ['Todos', ...categories];
    categoryFilters.innerHTML = cats.map(c =>
      `<button class="chip ${c === activeCategory ? 'active' : ''}" data-cat="${c}">${c}</button>`
    ).join('');
    categoryFilters.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        activeCategory = chip.dataset.cat;
        renderCategories();
        renderPrograms();
      });
    });
  }

  function fmtDuration(sec) {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function renderPrograms() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = programs.filter(p => {
      const matchesCat = activeCategory === 'Todos' || (p.category || 'Otros') === activeCategory;
      const matchesQuery = !query || p.title.toLowerCase().includes(query);
      return matchesCat && matchesQuery;
    });

    if (filtered.length === 0) {
      programsGrid.innerHTML = '<p class="loading">No hay programas que coincidan.</p>';
      return;
    }

    const playIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>`;

    programsGrid.innerHTML = filtered.map(p => `
      <div class="program-row" data-id="${p.id}">
        <div class="program-cover">
          ${p.cover_url
            ? `<img src="${p.cover_url}" alt="">`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/></svg>`}
          <div class="program-play-overlay">${playIcon}</div>
        </div>
        <div class="program-row-info">
          <div class="program-title">${escapeHtml(p.title)}</div>
          <div class="program-category">${escapeHtml(p.category || 'Otros')}</div>
        </div>
        <div class="program-duration">${fmtDuration(p.duration_seconds)}</div>
      </div>
    `).join('');

    programsGrid.querySelectorAll('.program-row').forEach(row => {
      row.addEventListener('click', () => {
        const program = programs.find(p => String(p.id) === row.dataset.id);
        if (program) playProgram(program);
      });
    });

    highlightPlayingCard(currentProgram ? currentProgram.id : null);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadPrograms() {
    try {
      const res = await fetch(`${API_BASE}/programs.php`);
      const data = await res.json();
      programs = data.programs || [];
      categories = data.categories || [];
      renderCategories();
      renderPrograms();
    } catch (e) {
      programsGrid.innerHTML = '<p class="loading">Error al cargar los programas.</p>';
    }
  }

  searchInput.addEventListener('input', renderPrograms);

  // Contador de visitantes únicos: id aleatorio guardado en este dispositivo,
  // sin IP ni datos personales (ver api/visit.php).
  async function registerVisit() {
    const el = document.getElementById('visitorCount');
    let vid = null;
    try {
      vid = localStorage.getItem('ra_vid');
      if (!vid) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        vid = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('ra_vid', vid);
      }
    } catch (e) { /* sin almacenamiento: solo mostramos el total */ }

    try {
      const res = await fetch(`${API_BASE}/visit.php`, vid ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vid }),
      } : undefined);
      const data = await res.json();
      el.textContent = Number(data.count).toLocaleString('es-ES');
    } catch (e) {
      document.getElementById('visitorCounter').hidden = true;
    }
  }

  registerVisit();
  loadLiveStatus();
  loadPrograms();
  setInterval(loadLiveStatus, 20000);

  // PWA: registra el service worker solo para el shell estático (ver
  // service-worker.js); si falla, la app sigue funcionando igual.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
