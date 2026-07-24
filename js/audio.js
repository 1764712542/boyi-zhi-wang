/* ============================================
   audio.js — 博弈之王 · 音频系统
   Web Audio API 程序化BGM + SFX音效 + Web Speech API 语音
   依赖：data.js（VOICE_PROFILES / BGM_THEMES / MENU_THEME）
   ============================================ */
'use strict';

/* 音频状态 */
const audioState = {
  ctx: null,
  masterGain: null,
  bgmGain: null,
  sfxGain: null,
  reverb: null,
  reverbGain: null,
  enabled: localStorage.getItem('bky_bgm') !== 'off',
  voiceEnabled: localStorage.getItem('bky_voice') !== 'off',
  sfxEnabled: localStorage.getItem('bky_sfx') !== 'off',
  currentTheme: null,
  bgmTimer: null,
  activeNodes: [],
  currentVoice: null
};

/* ===== 预制乐句库（按 mood 分类，8 音符动机） =====
   每个数字是相对主题音阶的步进索引（可为负 / 越八度），
   在 scaleNoteFreq 中会被限制在 4 个八度内循环。 */
const MOTIFS = {
  celestial:  [0, 4, 7, 12, 9, 7, 4, 0],   /* 仙帝：空灵上行回旋 */
  strategic:  [0, 2, 4, 7, 5, 4, 2, 0],    /* 谋略：稳进收束 */
  aggressive: [0, 3, 2, 0, -2, 0, 3, 5],   /* 进攻：紧逼下行再起 */
  wild:       [0, 5, 2, 7, 4, 9, 5, 2],    /* 狂野：大跳游走 */
  imposing:   [0, 0, 7, 5, 3, 5, 7, 0],    /* 霸王：厚重威压 */
  ambient:    [0, 4, 7, 9, 11, 9, 7, 4],   /* 环境：舒缓延展 */
  energetic:  [0, 2, 4, 2, 5, 4, 2, 0]     /* 活力：跳跃短促 */
};

/* 初始化音频上下文（需用户交互后激活） */
function initAudioContext(){
  if(audioState.ctx) return;
  try{
    audioState.ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioState.masterGain = audioState.ctx.createGain();
    audioState.masterGain.gain.value = 0.3;
    audioState.masterGain.connect(audioState.ctx.destination);

    /* 程序生成混响脉冲响应（2 秒指数衰减噪声） */
    audioState.reverb = audioState.ctx.createConvolver();
    audioState.reverb.buffer = createImpulseResponse(2.0, 2.5);
    audioState.reverbGain = audioState.ctx.createGain();
    audioState.reverbGain.gain.value = 0.22;
    audioState.reverb.connect(audioState.reverbGain);
    audioState.reverbGain.connect(audioState.masterGain);

    /* BGM 通道：干声 + 混响湿声并行 */
    audioState.bgmGain = audioState.ctx.createGain();
    audioState.bgmGain.gain.value = audioState.enabled ? 0.25 : 0;
    audioState.bgmGain.connect(audioState.masterGain);
    audioState.bgmGain.connect(audioState.reverb);

    /* SFX 通道：直达，保持短促清晰 */
    audioState.sfxGain = audioState.ctx.createGain();
    audioState.sfxGain.gain.value = audioState.sfxEnabled ? 0.2 : 0;
    audioState.sfxGain.connect(audioState.masterGain);
  }catch(e){ console.warn('AudioContext init failed', e); }
}

/* 生成混响脉冲响应 AudioBuffer */
function createImpulseResponse(duration, decay){
  const ctx = audioState.ctx;
  if(!ctx) return null;
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * duration));
  const buffer = ctx.createBuffer(2, len, rate);
  for(let ch=0; ch<2; ch++){
    const data = buffer.getChannelData(ch);
    for(let i=0;i<len;i++){
      data[i] = (Math.random()*2-1) * Math.pow(1 - i/len, decay);
    }
  }
  return buffer;
}

/* 播放单个音符（ADSR 包络 + 低通滤波 + 双振荡器失真切厚）
   gainScale：相对峰值增益的缩放（用于和声/低音/SFX 的音量平衡） */
function playNote(freq, duration, waveType, gainNode, delay=0, gainScale=1){
  if(!audioState.ctx) return;
  /* 防御非有限数值（NaN/Infinity）导致 AudioParam 报错 */
  if(!isFinite(freq)||freq<=0||!isFinite(duration)||duration<=0) return;
  const ctx = audioState.ctx;
  const t0 = ctx.currentTime + delay;
  const target = gainNode || audioState.bgmGain;

  /* 低通滤波柔化高频（锯齿/方波不再刺耳） */
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2800;
  filter.Q.value = 0.7;

  /* 双振荡器微失谐（±8 cents）模拟合奏厚度 */
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const wave = waveType || 'sine';
  osc1.type = wave; osc2.type = wave;
  osc1.frequency.value = freq;
  osc2.frequency.value = freq;
  osc1.detune.value = -8;
  osc2.detune.value = 8;

  /* ADSR：attack → decay → sustain → release */
  const peak = 0.32 * (gainScale || 1);
  const sustainLvl = peak * 0.55;
  const attack = Math.min(0.04, duration * 0.2);
  const decay = Math.min(0.08, duration * 0.25);
  const release = Math.min(0.15, duration * 0.35);
  const sustainEnd = Math.max(attack + decay + 0.01, duration - release);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.linearRampToValueAtTime(sustainLvl, t0 + attack + decay);
  g.gain.setValueAtTime(sustainLvl, t0 + sustainEnd);
  g.gain.linearRampToValueAtTime(0, t0 + duration);

  osc1.connect(g); osc2.connect(g);
  g.connect(filter); filter.connect(target);

  osc1.start(t0); osc2.start(t0);
  osc1.stop(t0 + duration + 0.05);
  osc2.stop(t0 + duration + 0.05);

  audioState.activeNodes.push(osc1, osc2);
  const cleanup = (osc) => {
    osc.onended = () => {
      const i = audioState.activeNodes.indexOf(osc);
      if(i >= 0) audioState.activeNodes.splice(i, 1);
    };
  };
  cleanup(osc1); cleanup(osc2);
}

/* 噪声脉冲（用于打击乐与 SFX 的噪声成分） */
function playNoiseBurst(duration, gainNode, filterType, freq, peak){
  if(!audioState.ctx) return;
  if(!isFinite(duration)||duration<=0) return;
  const ctx = audioState.ctx;
  const t0 = ctx.currentTime;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i] = Math.random()*2-1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType || 'highpass';
  filter.frequency.value = freq || 7000;
  const g = ctx.createGain();
  const p = peak || 0.3;
  g.gain.setValueAtTime(p, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  src.connect(filter); filter.connect(g); g.connect(gainNode || audioState.bgmGain);
  src.start(t0); src.stop(t0 + duration + 0.02);
}

/* 打击乐：kick（每 4 拍）—— sine 120→50Hz 快速下滑 */
function playKick(){
  if(!audioState.ctx) return;
  const ctx = audioState.ctx;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t0);
  osc.frequency.exponentialRampToValueAtTime(50, t0 + 0.08);
  g.gain.setValueAtTime(0.55, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
  osc.connect(g); g.connect(audioState.bgmGain);
  osc.start(t0); osc.stop(t0 + 0.12);
  audioState.activeNodes.push(osc);
  osc.onended = () => {
    const i = audioState.activeNodes.indexOf(osc);
    if(i >= 0) audioState.activeNodes.splice(i, 1);
  };
}

/* 打击乐：hihat（每 2 拍弱拍）—— 白噪声 + highpass 短衰减 */
function playHihat(){
  if(!audioState.ctx) return;
  playNoiseBurst(0.05, audioState.bgmGain, 'highpass', 7000, 0.1);
}

/* 频率计算：MIDI note 到 Hz */
function noteToFreq(midi){ return 440 * Math.pow(2, (midi - 69) / 12); }

/* 从音阶生成音符频率
   【致命 Bug 修复】将步进限制在 4 个八度内循环（含负数处理），
   防止 step 单调递增导致 octave 无限攀升到超声波。 */
function scaleNoteFreq(theme, stepIndex){
  const scaleLen = theme.scale.length;
  const span = scaleLen * 4; /* 限制 4 个八度内循环 */
  const wrapped = ((stepIndex % span) + span) % span;
  const idx = wrapped % scaleLen;
  const octave = Math.floor(wrapped / scaleLen);
  const semitone = theme.scale[idx] + octave * 12;
  return theme.root * Math.pow(2, semitone / 12);
}

/* 程序化BGM循环：按 motif 乐句循环 + 节奏骨架 + 和声层 */
function startBGM(themeKey){
  if(!audioState.ctx) initAudioContext();
  if(!audioState.ctx) return;
  stopBGM();
  const theme = BGM_THEMES[themeKey] || MENU_THEME;
  audioState.currentTheme = themeKey;
  if(!audioState.enabled) return;

  const motifKey = theme.motif || theme.mood || 'ambient';
  const motif = MOTIFS[motifKey] || MOTIFS.ambient;
  const motifLen = motif.length;
  const scaleLen = theme.scale.length;

  let step = 0;
  const beat = theme.tempo;
  const playBeat = () => {
    if(!audioState.ctx || audioState.currentTheme !== themeKey) return;

    /* 旋律线：按 motif 循环取音，30% 概率 ±1 音阶变奏 */
    const baseIdx = motif[step % motifLen];
    const variation = (Math.random() > 0.7) ? (Math.floor(Math.random()*3) - 1) : 0;
    const noteStep = baseIdx + variation;
    const freq = scaleNoteFreq(theme, noteStep);
    playNote(freq, beat * 1.6, theme.wave, audioState.bgmGain, 0, 0.45);

    /* 五度和声层（频率×1.5，gain 降低）增加厚度 */
    playNote(freq * 1.5, beat * 1.6, theme.wave, audioState.bgmGain, 0, 0.18);

    /* 低音衬底：每 4 拍一次 */
    if(step % 4 === 0){
      const bassFreq = theme.root / 2;
      playNote(bassFreq, beat * 3.5, theme.wave, audioState.bgmGain, 0, 0.35);
    }

    /* 节奏骨架：kick 每 4 拍，hihat 每 2 拍 */
    if(step % 4 === 0) playKick();
    if(step % 2 === 0) playHihat();

    /* Alice仙帝：星光效果（步进已包裹，不会再超声波） */
    if(theme.mood === 'celestial' && step % 3 === 0){
      const sparkle = scaleNoteFreq(theme, step + 7) * 2;
      if(isFinite(sparkle) && sparkle <= 8000){
        playNote(sparkle, 0.3, 'sine', audioState.bgmGain, beat * 0.5, 0.25);
      }
    }
    step++;
    audioState.bgmTimer = setTimeout(playBeat, beat * 1000);
  };
  playBeat();
}

function stopBGM(){
  if(audioState.bgmTimer){ clearTimeout(audioState.bgmTimer); audioState.bgmTimer = null; }
  audioState.currentTheme = null;
  audioState.activeNodes.forEach(n => { try{ n.stop(); }catch(e){} });
  audioState.activeNodes = [];
}

/* 切换BGM主题（带淡入淡出） */
function switchBGM(themeKey){
  if(audioState.currentTheme === themeKey) return;
  if(audioState.bgmGain){
    const now = audioState.ctx ? audioState.ctx.currentTime : 0;
    audioState.bgmGain.gain.linearRampToValueAtTime(0, now + 0.5);
    setTimeout(()=>{
      startBGM(themeKey);
      if(audioState.bgmGain && audioState.enabled){
        audioState.bgmGain.gain.linearRampToValueAtTime(0.25, (audioState.ctx?audioState.ctx.currentTime:0) + 1);
      }
    }, 600);
  } else {
    startBGM(themeKey);
  }
}

/* 菜单音乐 */
function playMenuBGM(){ if(audioState.enabled) switchBGM('menu'); }
/* 角色主题BGM */
function playCharacterBGM(charId){
  if(!audioState.enabled) return;
  const key = BGM_THEMES[charId] ? charId : 'menu';
  switchBGM(key);
}

/* ===== SFX 音效系统 ===== */
function playSfx(type){
  if(!audioState.ctx || !audioState.sfxEnabled) return;
  const sg = audioState.sfxGain;
  switch(type){
    case 'move':
      /* 短促木鱼声：triangle 800Hz，60ms */
      playNote(800, 0.06, 'triangle', sg, 0, 0.7);
      break;
    case 'capture':
      /* 金属碰撞：square 400Hz + 噪声，150ms 衰减 */
      playNote(400, 0.15, 'square', sg, 0, 0.6);
      playNote(600, 0.12, 'square', sg, 0.01, 0.35);
      playNoiseBurst(0.12, sg, 'bandpass', 2000, 0.25);
      break;
    case 'skill':
      /* 上行琶音 C-E-G-C 快速连发 */
      [0, 4, 7, 12].forEach((s, i) => {
        playNote(noteToFreq(60 + s), 0.12, 'triangle', sg, i * 0.06, 0.55);
      });
      break;
    case 'check':
      /* 警告双音 sine 880→660Hz */
      playNote(880, 0.18, 'sine', sg, 0, 0.6);
      playNote(660, 0.22, 'sine', sg, 0.12, 0.6);
      break;
    case 'win':
      /* 胜利大三和弦上行 C-E-G */
      [0, 4, 7].forEach((s, i) => {
        playNote(noteToFreq(60 + s), 0.3, 'triangle', sg, i * 0.12, 0.55);
      });
      break;
    case 'lose':
      /* 失败下行 A-F-D */
      [9, 5, 2].forEach((s, i) => {
        playNote(noteToFreq(57 + s), 0.35, 'sine', sg, i * 0.16, 0.55);
      });
      break;
    case 'click':
      /* UI 点击 sine 1000Hz，30ms */
      playNote(1000, 0.03, 'sine', sg, 0, 0.5);
      break;
    default:
      playNote(660, 0.05, 'sine', sg, 0, 0.4);
  }
}

/* 切换 SFX 开关 */
function toggleSfx(){
  audioState.sfxEnabled = !audioState.sfxEnabled;
  localStorage.setItem('bky_sfx', audioState.sfxEnabled ? 'on' : 'off');
  if(audioState.sfxGain){
    const now = audioState.ctx ? audioState.ctx.currentTime : 0;
    audioState.sfxGain.gain.linearRampToValueAtTime(audioState.sfxEnabled ? 0.2 : 0, now + 0.2);
  }
  updateAudioButtons();
}

/* ===== 语音系统（Web Speech API） ===== */
function speakText(text, charId){
  if(!audioState.voiceEnabled || !text) return;
  if(!('speechSynthesis' in window)) return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const profile = VOICE_PROFILES[charId] || { pitch: 1, rate: 1, lang: 'zh-CN' };
    u.lang = profile.lang;
    u.pitch = profile.pitch;
    u.rate = profile.rate;
    u.volume = 0.85;
    /* 尝试选择中文语音 */
    const voices = speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if(zhVoice) u.voice = zhVoice;
    speechSynthesis.speak(u);
  }catch(e){ /* 静默失败 */ }
}

function stopSpeech(){ try{ speechSynthesis.cancel(); }catch(e){} }

/* ===== 音频控制 UI ===== */
function updateAudioButtons(){
  const bgmBtn = document.getElementById('btn-bgm');
  const voiceBtn = document.getElementById('btn-voice');
  const sfxBtn = document.getElementById('btn-sfx');
  if(bgmBtn){
    bgmBtn.classList.toggle('muted', !audioState.enabled);
    bgmBtn.querySelector('.ctrl-icon').textContent = audioState.enabled ? '乐' : '静';
  }
  if(voiceBtn){
    voiceBtn.classList.toggle('muted', !audioState.voiceEnabled);
    voiceBtn.querySelector('.ctrl-icon').textContent = audioState.voiceEnabled ? '声' : '默';
  }
  if(sfxBtn){
    sfxBtn.classList.toggle('muted', !audioState.sfxEnabled);
    const icon = sfxBtn.querySelector('.ctrl-icon');
    if(icon) icon.textContent = audioState.sfxEnabled ? '效' : '哑';
  }
}

/* 首次用户交互后激活音频 */
let audioActivated=false;
function activateAudioOnInteraction(){
  if(audioActivated) return;
  audioActivated=true;
  initAudioContext();
  if(!audioState.ctx){ return; }
  /* 确保AudioContext已resume */
  const resumeAndPlay = () => {
    if(audioState.ctx && audioState.ctx.state==='running' && audioState.enabled && !audioState.currentTheme){
      startBGM('menu');
    }
  };
  if(audioState.ctx.state==='suspended'){
    audioState.ctx.resume().then(resumeAndPlay).catch(()=>{});
  } else {
    resumeAndPlay();
  }
  /* 预加载语音列表 */
  if('speechSynthesis' in window){
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = ()=>{ speechSynthesis.getVoices(); };
  }
}

/* 绑定音频按钮（DOM 就绪后调用） */
function bindAudioButtons(){
  const bgmBtn = document.getElementById('btn-bgm');
  const voiceBtn = document.getElementById('btn-voice');
  const sfxBtn = document.getElementById('btn-sfx');
  if(bgmBtn){
    bgmBtn.addEventListener('click',()=>{
      audioState.enabled = !audioState.enabled;
      localStorage.setItem('bky_bgm', audioState.enabled ? 'on' : 'off');
      if(audioState.bgmGain){
        const now = audioState.ctx ? audioState.ctx.currentTime : 0;
        audioState.bgmGain.gain.linearRampToValueAtTime(audioState.enabled ? 0.25 : 0, now + 0.3);
      }
      if(audioState.enabled && audioState.ctx && audioState.ctx.state==='running' && !audioState.currentTheme){
        const activeScreen = document.querySelector('.screen.active');
        if(activeScreen){
          if(activeScreen.id === 'screen-game') playCharacterBGM(state.character);
          else startBGM('menu');
        }
      }
      if(!audioState.enabled) stopBGM();
      updateAudioButtons();
    });
  }
  if(voiceBtn){
    voiceBtn.addEventListener('click',()=>{
      audioState.voiceEnabled = !audioState.voiceEnabled;
      localStorage.setItem('bky_voice', audioState.voiceEnabled ? 'on' : 'off');
      if(!audioState.voiceEnabled) stopSpeech();
      updateAudioButtons();
    });
  }
  if(sfxBtn){
    sfxBtn.addEventListener('click',()=>{
      toggleSfx();
      /* 切换时给一个反馈音 */
      if(audioState.sfxEnabled) playSfx('click');
    });
  }
  /* 首次交互激活 */
  document.addEventListener('click', activateAudioOnInteraction, { once: true });
  document.addEventListener('keydown', activateAudioOnInteraction, { once: true });
}
