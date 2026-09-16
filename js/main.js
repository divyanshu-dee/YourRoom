/* YourRoom — main.js */
'use strict';

// ─── QUOTES ───────────────────────────────────────
const quotes = [
  '"The secret of getting ahead is getting started." — Mark Twain',
  '"Study hard what interests you the most." — Richard Feynman',
  '"An investment in knowledge pays the best interest." — Benjamin Franklin',
  '"The beautiful thing about learning is that no one can take it away from you." — B.B. King',
  '"You dont have to be great to start, but you have to start to be great." — Zig Ziglar',
  '"Focus on being productive instead of busy." — Tim Ferriss',
  '"Success is the sum of small efforts, repeated day in and day out." — Robert Collier',
  '"Believe you can and youre halfway there." — Theodore Roosevelt',
];

// ─── PLAYLISTS ────────────────────────────────────
const playlists = [
  { title: 'Lofi Hip Hop',   artist: 'ChilledCow Radio',  videoId: 'jfKfPfyJRdk' },
  { title: 'Jazzy Study',    artist: 'Lofi Girl',          videoId: '0vv-QD3d0Pg' },
  { title: 'Chill Beats',    artist: 'Dreamy Lofi',        videoId: 'lTRiuFIWV54' },
];

// ─── POMODORO CONFIG ──────────────────────────────
const POMO_MODES = { focus: 25*60, short: 5*60, long: 15*60 };

// ─── STATE ────────────────────────────────────────
let ytPlayer = null;
let isPlaying = false;
let currentPlaylist = 0;
let activeAmbienceSounds = new Set(['rain']);
let ambienceNodes = {};
let audioCtx = null;
let ambienceVolume = 0.4;

let roomLight = false;
let deskLamp = true;
let fairyOn = true;
let candleOn = true;
let brightness = 0.3;

let pomoMode = 'focus';
let pomoTimeLeft = POMO_MODES.focus;
let pomoTotal = POMO_MODES.focus;
let pomoRunning = false;
let pomoInterval = null;
let pomoSessions = 0;

let currentScene = 'night';

// ─── DOM REFS ─────────────────────────────────────
const body = document.body;
const toast = document.getElementById('toast');
const musicViz = document.getElementById('music-viz');
const vizBars = musicViz.querySelectorAll('.viz-bar');

// ════════════════════════════════════════════
// YOUTUBE PLAYER
// ════════════════════════════════════════════
window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player('yt-player', {
    height: '0', width: '0',
    videoId: playlists[0].videoId,
    playerVars: { autoplay: 0, controls: 0, loop: 1, playlist: playlists[0].videoId },
    events: {
      onReady: () => console.log('YT ready'),
      onStateChange: onYTStateChange
    }
  });
};

function onYTStateChange(e) {
  if (e.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    document.getElementById('btn-play').textContent = '⏸';
    musicViz.classList.add('music-playing');
    animateBars();
  } else {
    isPlaying = false;
    document.getElementById('btn-play').textContent = '▶';
    musicViz.classList.remove('music-playing');
  }
}

function animateBars() {
  vizBars.forEach((bar, i) => {
    const h = Math.random() * 22 + 4;
    const dur = (Math.random() * 0.5 + 0.4).toFixed(2);
    bar.style.setProperty('--h', h + 'px');
    bar.style.setProperty('--dur', dur + 's');
    bar.style.setProperty('--delay', (i * 0.1) + 's');
  });
}

document.getElementById('btn-play').addEventListener('click', () => {
  if (!ytPlayer) { showToast('🎵 Loading player...'); return; }
  if (isPlaying) { ytPlayer.pauseVideo(); }
  else { ytPlayer.playVideo(); }
});

document.getElementById('btn-prev').addEventListener('click', () => {
  currentPlaylist = (currentPlaylist - 1 + playlists.length) % playlists.length;
  loadPlaylist(currentPlaylist);
});

document.getElementById('btn-next').addEventListener('click', () => {
  currentPlaylist = (currentPlaylist + 1) % playlists.length;
  loadPlaylist(currentPlaylist);
});

document.querySelectorAll('.playlist-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.playlist-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadPlaylist(+btn.dataset.playlist);
  });
});

function loadPlaylist(idx) {
  currentPlaylist = idx;
  const p = playlists[idx];
  document.getElementById('music-title').textContent = p.title;
  document.getElementById('music-artist').textContent = p.artist;
  document.querySelectorAll('.playlist-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
  if (ytPlayer) {
    ytPlayer.loadVideoById({ videoId: p.videoId, suggestedQuality: 'small' });
    ytPlayer.setVolume(+document.getElementById('volume-slider').value);
  }
  showToast(`🎵 Now playing: ${p.title}`);
}

document.getElementById('volume-slider').addEventListener('input', e => {
  if (ytPlayer) ytPlayer.setVolume(+e.target.value);
});

// ════════════════════════════════════════════
// WEB AUDIO - AMBIENT SOUNDS
// ════════════════════════════════════════════
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function createRainSound() {
  const ctx = getAudioCtx();
  const bufferSize = 4096;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);
  node.onaudioprocess = e => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) out[i] = Math.random() * 2 - 1;
  };
  const gain = ctx.createGain();
  gain.gain.value = ambienceVolume * 0.3;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 1200; filter.Q.value = 0.5;
  node.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  return { node, gain, filter };
}

function createNoiseSound(freq, q, gainVal) {
  const ctx = getAudioCtx();
  const bufferSize = 4096;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);
  node.onaudioprocess = e => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) out[i] = Math.random() * 2 - 1;
  };
  const gain = ctx.createGain();
  gain.gain.value = gainVal * ambienceVolume;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = freq;
  node.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  return { node, gain, filter };
}

function createCrackleSound() {
  const ctx = getAudioCtx();
  const bufferSize = 4096;
  let count = 0;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);
  node.onaudioprocess = e => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      count++;
      if (count > 100 + Math.random() * 200) {
        out[i] = (Math.random() * 2 - 1) * 0.8; count = 0;
      } else { out[i] = 0; }
    }
  };
  const gain = ctx.createGain();
  gain.gain.value = ambienceVolume * 0.5;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass'; filter.frequency.value = 2000;
  node.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  return { node, gain, filter };
}

const soundCreators = {
  rain:      () => createRainSound(),
  thunder:   () => createNoiseSound(400, 0.3, 0.2),
  fireplace: () => createCrackleSound(),
  cafe:      () => createNoiseSound(800, 0.4, 0.15),
  birds:     () => createNoiseSound(3000, 2, 0.08),
  fan:       () => createNoiseSound(200, 0.3, 0.2),
};

function toggleAmbience(name) {
  if (activeAmbienceSounds.has(name)) {
    stopAmbience(name); activeAmbienceSounds.delete(name);
    document.getElementById('amb-' + name).classList.remove('active');
    showToast(`🔇 ${name} off`);
  } else {
    startAmbience(name); activeAmbienceSounds.add(name);
    document.getElementById('amb-' + name).classList.add('active');
    showToast(`🔊 ${name} on`);
    if (name === 'rain') {
      body.classList.add('raining');
      startWindowRain();
    }
  }
  if (name === 'rain' && !activeAmbienceSounds.has('rain')) {
    body.classList.remove('raining'); clearWindowRain();
  }
}

function startAmbience(name) {
  try {
    const s = soundCreators[name](); ambienceNodes[name] = s;
  } catch(e) { console.warn('Audio error:', e); }
}

function stopAmbience(name) {
  const s = ambienceNodes[name];
  if (s) { try { s.gain.gain.value = 0; } catch(e) {} delete ambienceNodes[name]; }
}

document.querySelectorAll('.amb-btn').forEach(btn => {
  btn.addEventListener('click', () => toggleAmbience(btn.dataset.sound));
});

document.getElementById('ambience-volume').addEventListener('input', e => {
  ambienceVolume = +e.target.value / 100;
  Object.values(ambienceNodes).forEach(s => {
    if (s && s.gain) s.gain.gain.value = ambienceVolume * 0.3;
  });
});

// Start rain by default after interaction
function initDefaultAmbience() {
  body.classList.add('raining');
  startWindowRain();
  try { startAmbience('rain'); } catch(e) {}
  document.removeEventListener('click', initDefaultAmbience);
}
document.addEventListener('click', initDefaultAmbience);

// ════════════════════════════════════════════
// RAIN CANVAS
// ════════════════════════════════════════════
const rainCanvas = document.getElementById('rain-canvas');
const ctx2d = rainCanvas.getContext('2d');
let rainDrops = [];
let rainAnimId = null;

function initRainCanvas() {
  rainCanvas.width = window.innerWidth;
  rainCanvas.height = window.innerHeight;
}

function startRainCanvas() {
  if (rainAnimId) return;
  rainDrops = Array.from({length: 120}, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    speed: Math.random() * 4 + 6,
    length: Math.random() * 15 + 8,
    opacity: Math.random() * 0.4 + 0.1,
    width: Math.random() * 1.5 + 0.5,
  }));
  function animate() {
    ctx2d.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
    rainDrops.forEach(d => {
      ctx2d.beginPath();
      ctx2d.strokeStyle = `rgba(174,214,241,${d.opacity})`;
      ctx2d.lineWidth = d.width;
      ctx2d.moveTo(d.x, d.y);
      ctx2d.lineTo(d.x - 1, d.y + d.length);
      ctx2d.stroke();
      d.y += d.speed;
      if (d.y > rainCanvas.height + 20) { d.y = -20; d.x = Math.random() * rainCanvas.width; }
    });
    rainAnimId = requestAnimationFrame(animate);
  }
  animate();
}

function stopRainCanvas() {
  if (rainAnimId) { cancelAnimationFrame(rainAnimId); rainAnimId = null; }
  ctx2d.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
}

function startWindowRain() {
  startRainCanvas();
  const container = document.getElementById('window-rain-inner');
  if (!container.children.length) {
    for (let i = 0; i < 30; i++) {
      const drop = document.createElement('div');
      drop.className = 'rain-drop';
      drop.style.left = Math.random() * 100 + '%';
      drop.style.height = (Math.random() * 20 + 10) + 'px';
      drop.style.animationDuration = (Math.random() * 0.8 + 0.4) + 's';
      drop.style.animationDelay = (Math.random() * 2) + 's';
      drop.style.opacity = Math.random() * 0.5 + 0.2;
      container.appendChild(drop);
    }
  }
}

function clearWindowRain() { stopRainCanvas(); }
window.addEventListener('resize', () => { initRainCanvas(); if (body.classList.contains('raining')) startRainCanvas(); });
initRainCanvas();

// ════════════════════════════════════════════
// LIGHTS
// ════════════════════════════════════════════
document.getElementById('toggle-room-light').addEventListener('change', e => {
  roomLight = e.target.checked;
  body.classList.toggle('lights-on', roomLight);
  document.documentElement.style.setProperty('--brightness', roomLight ? Math.max(0.7, brightness) : Math.min(0.4, brightness));
  showToast(roomLight ? '💡 Room light on' : '🌙 Room light off');
});

document.getElementById('toggle-desk-lamp').addEventListener('change', e => {
  deskLamp = e.target.checked;
  document.getElementById('desk-lamp').classList.toggle('lamp-on', deskLamp);
  showToast(deskLamp ? '🔦 Desk lamp on' : '🔦 Desk lamp off');
});

document.getElementById('toggle-fairy').addEventListener('change', e => {
  fairyOn = e.target.checked;
  document.getElementById('fairy-lights').classList.toggle('off', !fairyOn);
  showToast(fairyOn ? '✨ Fairy lights on' : '✨ Fairy lights off');
});

document.getElementById('toggle-candle').addEventListener('change', e => {
  candleOn = e.target.checked;
  document.getElementById('candle-obj').classList.toggle('candle-off', !candleOn);
  showToast(candleOn ? '🕯️ Candle lit' : '🕯️ Candle out');
});

document.getElementById('brightness-slider').addEventListener('input', e => {
  brightness = +e.target.value / 100;
  document.documentElement.style.setProperty('--brightness', brightness);
});

// Init lamp-on state
document.getElementById('desk-lamp').classList.add('lamp-on');

// ════════════════════════════════════════════
// SCENE
// ════════════════════════════════════════════
document.querySelectorAll('.scene-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scene-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setScene(btn.dataset.scene);
  });
});

function setScene(scene) {
  body.classList.remove('scene-night', 'scene-sunset', 'scene-day', 'scene-rain');
  body.classList.add('scene-' + scene);
  currentScene = scene;
  const toasts = { night: '🌙 Night mode', sunset: '🌅 Sunset vibes', day: '☀️ Day mode', rain: '🌧️ Rainy day' };
  showToast(toasts[scene]);
  if (scene === 'rain' && !activeAmbienceSounds.has('rain')) {
    toggleAmbience('rain');
  }
}

// ════════════════════════════════════════════
// POMODORO TIMER
// ════════════════════════════════════════════
const CIRCUMFERENCE = 339.3;
const pomoProgress = document.getElementById('pomo-progress');
const pomoTimeEl = document.getElementById('pomo-time');
const pomoCountEl = document.getElementById('pomo-count');
const pomoStartBtn = document.getElementById('pomo-start');
const pomoResetBtn = document.getElementById('pomo-reset');

document.querySelectorAll('.pomo-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.pomo-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    switchPomoMode(tab.dataset.mode);
  });
});

function switchPomoMode(mode) {
  if (pomoRunning) stopPomo();
  pomoMode = mode;
  pomoTimeLeft = POMO_MODES[mode];
  pomoTotal = POMO_MODES[mode];
  updatePomoDisplay();
  const colors = { focus: '#f4a261', short: '#52b788', long: '#457b9d' };
  pomoProgress.style.stroke = colors[mode];
}

function startPomo() {
  if (pomoRunning) return;
  pomoRunning = true;
  pomoStartBtn.textContent = '⏸ Pause';
  pomoInterval = setInterval(() => {
    pomoTimeLeft--;
    updatePomoDisplay();
    if (pomoTimeLeft <= 0) {
      clearInterval(pomoInterval); pomoRunning = false;
      pomoStartBtn.textContent = '▶ Start';
      if (pomoMode === 'focus') { pomoSessions++; pomoCountEl.textContent = pomoSessions; }
      showToast(pomoMode === 'focus' ? '🍅 Focus session done! Take a break.' : '⏱️ Break over! Time to focus.');
      // Ring notification
      try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(() => { gain.gain.value = 0; osc.stop(); }, 600);
      } catch(e) {}
    }
  }, 1000);
}

function pausePomo() {
  clearInterval(pomoInterval); pomoRunning = false;
  pomoStartBtn.textContent = '▶ Start';
}

function stopPomo() { clearInterval(pomoInterval); pomoRunning = false; pomoStartBtn.textContent = '▶ Start'; }

function resetPomo() {
  stopPomo();
  pomoTimeLeft = POMO_MODES[pomoMode];
  pomoTotal = POMO_MODES[pomoMode];
  updatePomoDisplay();
}

function updatePomoDisplay() {
  const m = Math.floor(pomoTimeLeft / 60).toString().padStart(2, '0');
  const s = (pomoTimeLeft % 60).toString().padStart(2, '0');
  pomoTimeEl.textContent = m + ':' + s;
  const pct = pomoTimeLeft / pomoTotal;
  pomoProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
}

pomoStartBtn.addEventListener('click', () => {
  if (pomoRunning) { pausePomo(); } else { startPomo(); }
});
pomoResetBtn.addEventListener('click', resetPomo);

// ════════════════════════════════════════════
// CLOCK & SCREEN
// ════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  const H = now.getHours(), M = now.getMinutes(), S = now.getSeconds();
  // Wall clock hands
  const secDeg  = S * 6;
  const minDeg  = M * 6 + S * 0.1;
  const hourDeg = (H % 12) * 30 + M * 0.5;
  document.getElementById('second-hand').style.transform = `translateX(-50%) rotate(${secDeg}deg)`;
  document.getElementById('minute-hand').style.transform = `translateX(-50%) rotate(${minDeg}deg)`;
  document.getElementById('hour-hand').style.transform   = `translateX(-50%) rotate(${hourDeg}deg)`;
  // Screen clock
  const hh = H.toString().padStart(2,'0');
  const mm = M.toString().padStart(2,'0');
  const ss = S.toString().padStart(2,'0');
  document.getElementById('screen-clock').textContent = `${hh}:${mm}:${ss}`;
  // Screen date
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('screen-date').textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
}
setInterval(updateClock, 1000);
updateClock();

// Rotate screen quote
let quoteIdx = 0;
function rotateQuote() {
  document.getElementById('screen-quote').style.opacity = '0';
  setTimeout(() => {
    quoteIdx = (quoteIdx + 1) % quotes.length;
    document.getElementById('screen-quote').textContent = quotes[quoteIdx];
    document.getElementById('screen-quote').style.opacity = '1';
  }, 500);
}
document.getElementById('screen-quote').style.transition = 'opacity 0.5s ease';
document.getElementById('screen-quote').textContent = quotes[0];
setInterval(rotateQuote, 12000);

// ════════════════════════════════════════════
// STARS
// ════════════════════════════════════════════
function generateStars() {
  const container = document.getElementById('stars-container');
  for (let i = 0; i < 60; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    star.style.cssText = `
      left: ${Math.random()*100}%;
      top: ${Math.random()*100}%;
      width: ${size}px; height: ${size}px;
      --dur: ${(Math.random()*3+1).toFixed(1)}s;
      --del: ${(Math.random()*3).toFixed(1)}s;
    `;
    container.appendChild(star);
  }
}
generateStars();

// ════════════════════════════════════════════
// PANEL COLLAPSE
// ════════════════════════════════════════════
const panel = document.getElementById('control-panel');
const panelToggle = document.getElementById('panel-toggle-btn');
const panelOpenTab = document.getElementById('panel-open-tab');

panelToggle.addEventListener('click', () => {
  panel.classList.add('collapsed');
});
panelOpenTab.addEventListener('click', () => {
  panel.classList.remove('collapsed');
});

// ════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════
let toastTimeout;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ════════════════════════════════════════════
// VIZ BARS INIT
// ════════════════════════════════════════════
vizBars.forEach((bar, i) => {
  bar.style.setProperty('--h', (Math.random()*18+4) + 'px');
  bar.style.setProperty('--dur', (Math.random()*0.5+0.4).toFixed(2) + 's');
  bar.style.setProperty('--delay', (i * 0.08) + 's');
});

// ════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  switch(e.key) {
    case ' ': e.preventDefault();
      document.getElementById('btn-play').click(); break;
    case 'l': case 'L':
      document.getElementById('toggle-room-light').click(); break;
    case 'r': case 'R':
      document.getElementById('amb-rain').click(); break;
    case 'p': case 'P':
      pomoStartBtn.click(); break;
    case 'Escape':
      panel.classList.toggle('collapsed'); break;
  }
});

console.log('%c🏠 YourRoom loaded! Press Space=music, L=light, R=rain, P=pomodoro, Esc=panel', 'color:#f4a261;font-size:14px;font-weight:bold');
