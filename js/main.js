/* YourRoom main.js - Fixed */
'use strict';

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

const playlists = [
  { title: 'Lofi Hip Hop',  artist: 'ChilledCow Radio', videoId: 'jfKfPfyJRdk' },
  { title: 'Jazzy Study',   artist: 'Lofi Girl',         videoId: '0vv-QD3d0Pg' },
  { title: 'Chill Beats',   artist: 'Dreamy Lofi',       videoId: 'lTRiuFIWV54' },
];

const POMO_MODES = { focus: 25*60, short: 5*60, long: 15*60 };


let activeAmbienceSounds = new Set();
let ambienceNodes   = {};
let audioCtx        = null;
let ambienceVolume  = 0.4;
let roomLight       = false;
let deskLamp        = true;
let fairyOn         = true;
let candleOn        = true;
let brightness      = 0.3;
let pomoMode        = 'focus';
let pomoTimeLeft    = POMO_MODES.focus;
let pomoTotal       = POMO_MODES.focus;
let pomoRunning     = false;
let pomoInterval    = null;
let pomoSessions    = 0;

const body     = document.body;
const toast    = document.getElementById('toast');
const musicViz = document.getElementById('music-viz');
const vizBars  = musicViz.querySelectorAll('.viz-bar');

// ════════════════════════════════════════════
// MUSIC — YouTube iframe embed (no API needed)
// ════════════════════════════════════════════
const ytIframe   = document.getElementById('yt-iframe');
const BASE_URL   = 'https://www.youtube.com/embed/';
const YT_PARAMS  = '?autoplay=1&loop=1&controls=0&rel=0&modestbranding=1&enablejsapi=0&origin=';

let isPlaying       = false;
let currentPlaylist = 0;

function getEmbedUrl(videoId) {
  return BASE_URL + videoId + YT_PARAMS + encodeURIComponent(location.origin || 'file://') + '&playlist=' + videoId;
}

function animateBars() {
  vizBars.forEach((bar,i) => {
    bar.style.setProperty('--h', (Math.random()*22+4)+'px');
    bar.style.setProperty('--dur', (Math.random()*0.5+0.4).toFixed(2)+'s');
    bar.style.setProperty('--delay', (i*0.1)+'s');
  });
}

function setMusicState(playing) {
  isPlaying = playing;
  document.getElementById('btn-play').textContent = playing ? '⏸' : '▶';
  musicViz.classList.toggle('music-playing', playing);
  if (playing) animateBars();
}

function playMusic() {
  const videoId = playlists[currentPlaylist].videoId;
  ytIframe.src = getEmbedUrl(videoId);
  setMusicState(true);
}

function stopMusic() {
  ytIframe.src = '';
  setMusicState(false);
}

document.getElementById('btn-play').addEventListener('click', () => {
  if (isPlaying) stopMusic();
  else           playMusic();
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
  btn.addEventListener('click', () => loadPlaylist(+btn.dataset.playlist));
});

function loadPlaylist(idx) {
  currentPlaylist = idx;
  const p = playlists[idx];
  document.getElementById('music-title').textContent  = p.title;
  document.getElementById('music-artist').textContent = p.artist;
  document.querySelectorAll('.playlist-btn').forEach((b,i) => b.classList.toggle('active', i===idx));
  if (isPlaying) playMusic();
  showToast('🎵 ' + p.title);
}

// Volume: postMessage to iframe (works on deployed https, not file://)
document.getElementById('volume-slider').addEventListener('input', e => {
  try {
    ytIframe.contentWindow.postMessage(JSON.stringify({
      event: 'command', func: 'setVolume', args: [+e.target.value]
    }), '*');
  } catch(_) {}
});

// ════════════════════════════════════════════
// WEB AUDIO — AMBIENT SOUNDS
// ════════════════════════════════════════════
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function createRainSound() {
  const ctx = getAudioCtx();
  const bufferSize = 4096;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);
  node.onaudioprocess = e => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) out[i] = Math.random()*2 - 1;
  };
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 1200; filter.Q.value = 0.5;
  const gain = ctx.createGain();
  gain.gain.value = ambienceVolume * 0.25;
  node.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  return { node, gain, filter };
}

function createNoiseSound(freq, gainVal) {
  const ctx = getAudioCtx();
  const bufferSize = 4096;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);
  node.onaudioprocess = e => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) out[i] = Math.random()*2 - 1;
  };
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = gainVal * ambienceVolume;
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
      if (count > 100 + Math.random()*200) { out[i] = (Math.random()*2-1)*0.8; count=0; }
      else out[i] = 0;
    }
  };
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass'; filter.frequency.value = 1500;
  const gain = ctx.createGain();
  gain.gain.value = ambienceVolume * 0.4;
  node.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  return { node, gain, filter };
}

const soundCreators = {
  rain:      () => createRainSound(),
  thunder:   () => createNoiseSound(400, 0.18),
  fireplace: () => createCrackleSound(),
  cafe:      () => createNoiseSound(800, 0.12),
  birds:     () => createNoiseSound(3000, 0.06),
  fan:       () => createNoiseSound(200, 0.18),
};

function toggleAmbience(name) {
  if (activeAmbienceSounds.has(name)) {
    stopAmbienceSound(name);
    activeAmbienceSounds.delete(name);
    document.getElementById('amb-' + name).classList.remove('active');
    showToast(`🔇 ${name} off`);
    if (name === 'rain') { body.classList.remove('raining'); clearWindowRain(); }
  } else {
    try { startAmbienceSound(name); } catch(err) { console.warn('Audio:', err); }
    activeAmbienceSounds.add(name);
    document.getElementById('amb-' + name).classList.add('active');
    showToast(`🔊 ${name} on`);
    if (name === 'rain') { body.classList.add('raining'); startWindowRain(); }
  }
}

function startAmbienceSound(name) {
  const s = soundCreators[name](); ambienceNodes[name] = s;
}

function stopAmbienceSound(name) {
  const s = ambienceNodes[name];
  if (s) { try { s.gain.gain.value = 0; } catch(e){} delete ambienceNodes[name]; }
}

document.querySelectorAll('.amb-btn').forEach(btn => {
  btn.addEventListener('click', () => toggleAmbience(btn.dataset.sound));
});

document.getElementById('ambience-volume').addEventListener('input', e => {
  ambienceVolume = +e.target.value / 100;
  Object.values(ambienceNodes).forEach(s => {
    if (s && s.gain) s.gain.gain.value = ambienceVolume * 0.25;
  });
});

// ════════════════════════════════════════════
// WINDOW RAIN — CSS only, inside window glass
// (No full-screen canvas. Canvas removed from DOM via CSS.)
// ════════════════════════════════════════════
function startWindowRain() {
  const container = document.getElementById('window-rain-inner');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const drop = document.createElement('div');
    drop.className = 'rain-drop';
    drop.style.cssText = `
      left: ${Math.random()*100}%;
      height: ${Math.random()*18+8}px;
      animation-duration: ${(Math.random()*0.7+0.3).toFixed(2)}s;
      animation-delay: ${(Math.random()*2).toFixed(2)}s;
      opacity: ${(Math.random()*0.5+0.25).toFixed(2)};
      width: ${(Math.random()*1+0.5).toFixed(1)}px;
    `;
    container.appendChild(drop);
  }
}

function clearWindowRain() {
  const container = document.getElementById('window-rain-inner');
  if (container) container.innerHTML = '';
}

// ════════════════════════════════════════════
// LIGHTS
// ════════════════════════════════════════════
document.getElementById('toggle-room-light').addEventListener('change', e => {
  roomLight = e.target.checked;
  body.classList.toggle('lights-on', roomLight);
  const newB = roomLight ? Math.max(0.7, brightness) : Math.min(0.4, brightness);
  document.documentElement.style.setProperty('--brightness', newB);
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
  body.classList.remove('scene-night','scene-sunset','scene-day','scene-rain');
  body.classList.add('scene-' + scene);
  const msgs = { night:'🌙 Night mode', sunset:'🌅 Sunset vibes', day:'☀️ Day mode', rain:'🌧️ Rainy day' };
  showToast(msgs[scene]);
  if (scene === 'rain' && !activeAmbienceSounds.has('rain')) toggleAmbience('rain');
}

// ════════════════════════════════════════════
// POMODORO TIMER
// ════════════════════════════════════════════
const CIRCUMFERENCE = 339.3;
const pomoProgress  = document.getElementById('pomo-progress');
const pomoTimeEl    = document.getElementById('pomo-time');
const pomoCountEl   = document.getElementById('pomo-count');
const pomoStartBtn  = document.getElementById('pomo-start');
const pomoResetBtn  = document.getElementById('pomo-reset');

document.querySelectorAll('.pomo-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.pomo-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    switchPomoMode(tab.dataset.mode);
  });
});

function switchPomoMode(mode) {
  if (pomoRunning) stopPomo();
  pomoMode     = mode;
  pomoTimeLeft = POMO_MODES[mode];
  pomoTotal    = POMO_MODES[mode];
  updatePomoDisplay();
  const colors = { focus:'#f4a261', short:'#52b788', long:'#457b9d' };
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
      showToast(pomoMode === 'focus' ? '🍅 Session done! Take a break.' : '⏱️ Break over! Focus time.');
      try {
        const actx = getAudioCtx();
        const osc  = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain); gain.connect(actx.destination);
        osc.frequency.value = 880; gain.gain.value = 0.25;
        osc.start(); setTimeout(() => { gain.gain.value = 0; osc.stop(); }, 500);
      } catch(e) {}
    }
  }, 1000);
}

function pausePomo() {
  clearInterval(pomoInterval); pomoRunning = false; pomoStartBtn.textContent = '▶ Start';
}

function stopPomo() {
  clearInterval(pomoInterval); pomoRunning = false; pomoStartBtn.textContent = '▶ Start';
}

function resetPomo() {
  stopPomo(); pomoTimeLeft = POMO_MODES[pomoMode]; pomoTotal = POMO_MODES[pomoMode]; updatePomoDisplay();
}

function updatePomoDisplay() {
  const m  = Math.floor(pomoTimeLeft/60).toString().padStart(2,'0');
  const s  = (pomoTimeLeft%60).toString().padStart(2,'0');
  pomoTimeEl.textContent = m + ':' + s;
  pomoProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - pomoTimeLeft/pomoTotal);
}

pomoStartBtn.addEventListener('click', () => { if (pomoRunning) pausePomo(); else startPomo(); });
pomoResetBtn.addEventListener('click', resetPomo);

// ════════════════════════════════════════════
// CLOCK
// ════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  const H = now.getHours(), M = now.getMinutes(), S = now.getSeconds();
  document.getElementById('second-hand').style.transform = `translateX(-50%) rotate(${S*6}deg)`;
  document.getElementById('minute-hand').style.transform = `translateX(-50%) rotate(${M*6+S*0.1}deg)`;
  document.getElementById('hour-hand').style.transform   = `translateX(-50%) rotate(${(H%12)*30+M*0.5}deg)`;
  const hh = H.toString().padStart(2,'0');
  const mm = M.toString().padStart(2,'0');
  const ss = S.toString().padStart(2,'0');
  document.getElementById('screen-clock').textContent = `${hh}:${mm}:${ss}`;
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('screen-date').textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
}
setInterval(updateClock, 1000);
updateClock();

let quoteIdx = 0;
function rotateQuote() {
  const el = document.getElementById('screen-quote');
  el.style.opacity = '0';
  setTimeout(() => {
    quoteIdx = (quoteIdx+1) % quotes.length;
    el.textContent = quotes[quoteIdx];
    el.style.opacity = '1';
  }, 500);
}
const quoteEl = document.getElementById('screen-quote');
quoteEl.style.transition = 'opacity 0.5s ease';
quoteEl.textContent = quotes[0];
setInterval(rotateQuote, 12000);

// ════════════════════════════════════════════
// STARS
// ════════════════════════════════════════════
function generateStars() {
  const container = document.getElementById('stars-container');
  for (let i = 0; i < 60; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random()*2.5+0.5;
    star.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;width:${size}px;height:${size}px;--dur:${(Math.random()*3+1).toFixed(1)}s;--del:${(Math.random()*3).toFixed(1)}s;`;
    container.appendChild(star);
  }
}
generateStars();

// ════════════════════════════════════════════
// PANEL COLLAPSE
// ════════════════════════════════════════════
const panel         = document.getElementById('control-panel');
const panelToggle   = document.getElementById('panel-toggle-btn');
const panelOpenTab  = document.getElementById('panel-open-tab');
panelToggle.addEventListener('click',  () => panel.classList.add('collapsed'));
panelOpenTab.addEventListener('click', () => panel.classList.remove('collapsed'));

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
  bar.style.setProperty('--h', (Math.random()*18+4)+'px');
  bar.style.setProperty('--dur', (Math.random()*0.5+0.4).toFixed(2)+'s');
  bar.style.setProperty('--delay', (i*0.08)+'s');
});

// ════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  switch(e.key) {
    case ' ':  e.preventDefault(); document.getElementById('btn-play').click(); break;
    case 'l': case 'L': document.getElementById('toggle-room-light').click(); break;
    case 'r': case 'R': document.getElementById('amb-rain').click(); break;
    case 'p': case 'P': pomoStartBtn.click(); break;
    case 'Escape': panel.classList.toggle('collapsed'); break;
  }
});

console.log('%c🏠 YourRoom — Space=music | L=light | R=rain | P=pomo | Esc=panel', 'color:#f4a261;font-size:13px;font-weight:bold');
