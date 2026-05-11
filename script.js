let currentColor = 'gold';
let currentMode  = 'dark';
let trackCount   = 0;

// ── Rating ──
const ratingRow = document.getElementById('rating-row');
for (let i = 1; i <= 10; i++) {
  const b = document.createElement('button');
  b.className = 'r-btn'; b.textContent = i;
  b.onclick = () => {
    document.querySelectorAll('.r-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('i-custom').value = '';
    document.getElementById('t-score').textContent = i;
  };
  ratingRow.appendChild(b);
}
function customRating(v) {
  document.querySelectorAll('.r-btn').forEach(x => x.classList.remove('active'));
  document.getElementById('t-score').textContent = v.trim() || '—';
}

// ── Tracks ──
function addTrack(value = '') {
  trackCount++;
  const n = trackCount;
  const list = document.getElementById('tracks-list');

  const row = document.createElement('div');
  row.className = 'track-row';
  row.dataset.id = n;

  const badge = document.createElement('div');
  badge.className = 'track-num-badge';
  badge.textContent = String(n).padStart(2, '0');

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = `Canción ${n}`;
  inp.value = value;
  inp.oninput = syncTracks;

  const del = document.createElement('button');
  del.className = 'btn-icon';
  del.innerHTML = '×';
  del.title = 'Eliminar';
  del.onclick = () => { row.remove(); renumberTracks(); syncTracks(); };

  row.appendChild(badge);
  row.appendChild(inp);
  row.appendChild(del);
  list.appendChild(row);

  inp.focus();
}

function renumberTracks() {
  const rows = document.querySelectorAll('#tracks-list .track-row');
  rows.forEach((row, i) => {
    row.querySelector('.track-num-badge').textContent = String(i + 1).padStart(2, '0');
  });
  trackCount = rows.length;
}

function syncTracks() {
  const rows = document.querySelectorAll('#tracks-list .track-row');
  const names = Array.from(rows).map(r => r.querySelector('input').value.trim());
  const filled = names.filter(n => n).length;

  const nameFontSize = filled <= 3 ? 42 : filled <= 5 ? 36 : filled <= 7 ? 30 : 24;
  const numFontSize  = filled <= 3 ? 48 : filled <= 5 ? 40 : filled <= 7 ? 34 : 26;

  const container = document.getElementById('t-tracks-list');
  container.innerHTML = '';

  names.forEach((name, i) => {
    if (!name) return;
    const item = document.createElement('div');
    item.className = 't-track-item';

    const num = document.createElement('div');
    num.className = 't-track-num';
    num.style.fontSize = numFontSize + 'px';
    num.textContent = String(i + 1).padStart(2, '0');

    const title = document.createElement('div');
    title.className = 't-track-name';
    title.style.fontSize = nameFontSize + 'px';
    title.textContent = name;

    item.appendChild(num);
    item.appendChild(title);
    container.appendChild(item);
  });
}

// ── Cover ──
// Converts a blob/object URL to a base64 data URL so html2canvas can read it
// on WebKit (iOS Safari) without triggering a cross-origin canvas taint error.
function blobToBase64(url) {
  return fetch(url)
    .then(r => r.blob())
    .then(blob => new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    }));
}

async function loadCoverURL(url) {
  const src = url.startsWith('blob:') ? await blobToBase64(url) : url;
  const edImg = document.getElementById('editor-cover-img');
  edImg.src = src; edImg.style.display = 'block';
  document.getElementById('upload-hint').style.opacity = '0';
  const tImg = document.getElementById('t-cover-img');
  tImg.src = src; tImg.style.display = 'block';
  document.getElementById('t-cover-placeholder').style.display = 'none';
}
function handleFile(inp) { const f = inp.files[0]; if (f) loadCoverURL(URL.createObjectURL(f)); }
function onDragOver(e)   { e.preventDefault(); document.getElementById('cover-drop').classList.add('dragover'); }
function onDragLeave()   { document.getElementById('cover-drop').classList.remove('dragover'); }
function onDrop(e)       {
  e.preventDefault(); document.getElementById('cover-drop').classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadCoverURL(URL.createObjectURL(f));
}

// ── Sync general ──
function sync() {
  const artist = document.getElementById('i-artist').value.trim();
  const album  = document.getElementById('i-album').value.trim();
  const year   = document.getElementById('i-year').value.trim();
  const genre  = document.getElementById('i-genre').value.trim();
  const link   = document.getElementById('i-link').value.trim();

  document.getElementById('t-artist').textContent = artist || 'Artista';
  document.getElementById('t-album').textContent  = album  || 'Álbum';
  document.getElementById('t-year').textContent   = year   || '—';
  document.getElementById('t-genre-tag').textContent = genre || 'Género';

  const len = (album || 'Álbum').length;
  document.getElementById('t-album').style.fontSize = len <= 10 ? '152px' : len <= 16 ? '118px' : len <= 22 ? '88px' : '68px';

  const tLink = document.getElementById('t-link');
  tLink.textContent = link;
  tLink.style.display = link ? 'block' : 'none';
}

// ── Theme ──
let usingCustom = false;

function applyTheme() {
  const t = document.getElementById('story-template');
  if (!usingCustom) {
    clearCustomVars(t);
    t.dataset.color = currentColor;
    t.dataset.mode  = currentMode;
  }
}

function setColor(btn) {
  usingCustom = false;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('picker-btn').classList.remove('active');
  document.getElementById('hex-wrap').classList.remove('visible');
  btn.classList.add('active');
  currentColor = btn.dataset.color;
  applyTheme();
}

function setMode(btn) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentMode = btn.dataset.mode;
  if (usingCustom) {
    const hex = document.getElementById('hex-input').value ||
                document.getElementById('color-input').value.replace('#','');
    if (hex.length === 6) applyCustomColor('#' + hex);
  } else {
    applyTheme();
  }
}

// ── Custom color ──
function openPicker(e) {
  if (window.EyeDropper) {
    e.preventDefault();
    const dropper = new EyeDropper();
    dropper.open().then(result => {
      activateCustom(result.sRGBHex);
    }).catch(() => {
      document.getElementById('color-input').click();
    });
  }
}

function onColorInput(hex) {
  activateCustom(hex);
}

function onHexType(val) {
  const clean = val.replace(/[^0-9a-fA-F]/g, '');
  document.getElementById('hex-input').value = clean;
  if (clean.length === 6) {
    activateCustom('#' + clean);
    document.getElementById('color-input').value = '#' + clean;
  }
}

function activateCustom(hex) {
  usingCustom = true;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('picker-btn').classList.add('active');
  document.getElementById('hex-wrap').classList.add('visible');
  document.getElementById('hex-input').value = hex.replace('#','').toUpperCase();
  document.getElementById('color-input').value = hex;
  applyCustomColor(hex);
}

function applyCustomColor(hex) {
  const t = document.getElementById('story-template');
  t.dataset.color = 'custom';
  t.dataset.mode  = currentMode;

  const [r, g, b] = hexToRgb(hex);
  const isDark = currentMode === 'dark';

  const bg    = isDark
    ? mixRgb(r, g, b,   0,   0,   0, 0.92)
    : mixRgb(r, g, b, 255, 255, 255, 0.93);

  const text  = isDark ? '#f2eeea' : '#141010';
  const muted = isDark
    ? mixRgb(r, g, b,  40,  40,  40, 0.72)
    : '#aaaaaa';

  const finalAccent = isDark ? hex : darken(r, g, b, 0.65);

  const tagBg = `rgba(${r},${g},${b},${isDark ? .13 : .10})`;
  const tagBd = `rgba(${r},${g},${b},${isDark ? .30 : .25})`;
  const sep   = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.09)';

  t.style.setProperty('--t-bg',     bg);
  t.style.setProperty('--t-grad',   bg);
  t.style.setProperty('--t-text',   text);
  t.style.setProperty('--t-accent', finalAccent);
  t.style.setProperty('--t-muted',  muted);
  t.style.setProperty('--t-tag-bg', tagBg);
  t.style.setProperty('--t-tag-bd', tagBd);
  t.style.setProperty('--t-sep',    sep);
}

function clearCustomVars(t) {
  ['--t-bg','--t-grad','--t-text','--t-accent','--t-muted','--t-tag-bg','--t-tag-bd','--t-sep']
    .forEach(v => t.style.removeProperty(v));
}

// ── Color math helpers ──
function hexToRgb(hex) {
  const h = hex.replace('#','');
  return [
    parseInt(h.slice(0,2), 16),
    parseInt(h.slice(2,4), 16),
    parseInt(h.slice(4,6), 16),
  ];
}
function mixRgb(r, g, b, br, bg, bb, t) {
  const mix = (a, ba) => Math.round(a * (1 - t) + ba * t);
  return `rgb(${mix(r,br)},${mix(g,bg)},${mix(b,bb)})`;
}
function darken(r, g, b, factor) {
  return `rgb(${Math.round(r*factor)},${Math.round(g*factor)},${Math.round(b*factor)})`;
}

// ── Preview scaling (responsive) ──
function resizePreview() {
  const wrapper = document.querySelector('.story-wrapper');
  if (!wrapper) return;
  const w = wrapper.offsetWidth;
  if (!w) return;
  const scale = w / 1080;
  document.getElementById('story-template').style.transform = `scale(${scale})`;
}

// ── Tabs (mobile) ──
function switchTab(btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  document.querySelector('.editor').classList.toggle('tab-hidden', tab !== 'editor');
  document.querySelector('.preview-panel').classList.toggle('tab-hidden', tab !== 'preview');
  if (tab === 'preview') resizePreview();
}

// ── Export ──
async function exportStory() {
  const btn = document.getElementById('export-btn');
  btn.disabled = true; btn.textContent = 'GENERANDO…';
  await document.fonts.ready;

  const tmpl    = document.getElementById('story-template');
  const wrapper = document.querySelector('.story-wrapper');

  tmpl.style.transform = 'none';
  tmpl.style.position  = 'fixed';
  tmpl.style.top       = '0';
  tmpl.style.left      = '-1200px';
  tmpl.style.zIndex    = '99999';
  document.body.appendChild(tmpl);

  await new Promise(r => setTimeout(r, 100));

  try {
    const canvas = await html2canvas(tmpl, {
      scale: 1, useCORS: true, allowTaint: false,
      backgroundColor: null, logging: false, width: 1080, height: 1920,
    });
    const dataUrl  = canvas.toDataURL('image/png');
    const filename = `story-${document.getElementById('i-artist').value || 'album'}-${Date.now()}.png`;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      // iOS Safari ignores the download attribute — open in a new tab so the
      // user can long-press the image and tap "Guardar en Fotos".
      const win = window.open('', '_blank');
      win.document.write(
        `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>Guardar historia</title><style>body{margin:0;background:#000;display:flex;flex-direction:column;align-items:center;padding:16px;font-family:sans-serif;color:#fff;gap:12px}` +
        `img{max-width:100%;border-radius:8px}p{font-size:13px;opacity:.7;text-align:center}</style></head>` +
        `<body><img src="${dataUrl}"><p>Mantén presionada la imagen y elige<br><strong>"Guardar imagen"</strong></p></body></html>`
      );
      win.document.close();
    } else {
      const a = document.createElement('a');
      a.download = filename;
      a.href = dataUrl;
      a.click();
    }
  } catch (err) {
    console.error(err);
    alert('Error al exportar: ' + err.message);
  } finally {
    tmpl.style.transform = '';
    tmpl.style.position  = 'absolute';
    tmpl.style.top = '0'; tmpl.style.left = '0'; tmpl.style.zIndex = '';
    wrapper.appendChild(tmpl);
    resizePreview();
    btn.disabled = false; btn.textContent = '⬇ EXPORTAR HISTORIA';
  }
}

// ── Init ──
addTrack(); addTrack(); addTrack();
resizePreview();
window.addEventListener('resize', resizePreview);
