/* ============================================
   portrait.js — 博弈之王 · SVG 头像系统
   纯内联 SVG，无外部 API 依赖
   依赖：data.js（CHARACTERS）
   每角色：独特脸型 + 色彩主题 + 中央汉字
   ============================================ */
'use strict';

/* 角色个性风格映射：shape 决定脸型，accent 决定装饰图案 */
const PORTRAIT_STYLES = {
  houzhibo:    { shape:'hex',     accent:'fan' },
  wangxin:     { shape:'round',   accent:'book' },
  zhouzihan:   { shape:'oval',    accent:'wave' },
  sanjin:      { shape:'square',  accent:'spark' },
  jige:        { shape:'mask',    accent:'note' },
  ikun:        { shape:'star',    accent:'ball' },
  huhao:       { shape:'shield',  accent:'sword' },
  xieyuxuan:   { shape:'hex',     accent:'grid' },
  luxingchen:  { shape:'square',  accent:'code' },
  tangboyuhan: { shape:'round',   accent:'pen' },
  alice:       { shape:'star',    accent:'halo' },
  bking:       { shape:'crown',   accent:'flame' },
  liuqi:       { shape:'square',  accent:'table' },
  liuxuepei:   { shape:'oval',    accent:'snow' },
  liujiawei:   { shape:'shield',  accent:'mountain' },
  yuanqingshan:{ shape:'round',   accent:'mist' },
  luolunjie:   { shape:'flame',   accent:'blade' },
  daaixianzun: { shape:'halo',    accent:'lotus' },
  /* v34: 通天教主 — 截教之主，水晶八面体 + 诛仙雷霆 */
  tongtian:    { shape:'crystal', accent:'thunder' }
};

/* 颜色工具：调亮/调暗 hex */
function lighten(hex, amt){
  const h = String(hex||'').replace('#','');
  if(h.length !== 6) return hex;
  const r = Math.min(255, Math.max(0, parseInt(h.slice(0,2),16) + amt));
  const g = Math.min(255, Math.max(0, parseInt(h.slice(2,4),16) + amt));
  const b = Math.min(255, Math.max(0, parseInt(h.slice(4,6),16) + amt));
  return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function darken(hex, amt){ return lighten(hex, -amt); }

/* 构造脸型 SVG 片段 */
function faceShape(shape, color, light, dark){
  switch(shape){
    case 'hex':
      return `<path d="M40 8 L66 22 L66 58 L40 72 L14 58 L14 22 Z" fill="${color}" stroke="${dark}" stroke-width="2"/><path d="M40 8 L66 22 L66 58 L40 72 L14 58 L14 22 Z" fill="${light}" opacity="0.18"/>`;
    case 'square':
      return `<rect x="12" y="10" width="56" height="60" rx="10" fill="${color}" stroke="${dark}" stroke-width="2"/><rect x="12" y="10" width="56" height="60" rx="10" fill="${light}" opacity="0.15"/>`;
    case 'oval':
      return `<ellipse cx="40" cy="40" rx="28" ry="32" fill="${color}" stroke="${dark}" stroke-width="2"/><ellipse cx="40" cy="40" rx="28" ry="32" fill="${light}" opacity="0.16"/>`;
    case 'shield':
      return `<path d="M40 8 L68 16 L68 44 Q68 60 40 72 Q12 60 12 44 L12 16 Z" fill="${color}" stroke="${dark}" stroke-width="2"/><path d="M40 8 L68 16 L68 44 Q68 60 40 72 Q12 60 12 44 L12 16 Z" fill="${light}" opacity="0.15"/>`;
    case 'mask':
      return `<path d="M40 10 Q16 12 14 36 Q14 56 40 64 Q66 56 66 36 Q64 12 40 10 Z" fill="${color}" stroke="${dark}" stroke-width="2"/><path d="M22 30 Q28 26 34 30 M46 30 Q52 26 58 30" stroke="${dark}" stroke-width="1.5" fill="none" opacity="0.6"/>`;
    case 'star':
      return `<path d="M40 6 L49 28 L72 30 L54 46 L60 70 L40 56 L20 70 L26 46 L8 30 L31 28 Z" fill="${color}" stroke="${dark}" stroke-width="2"/><path d="M40 6 L49 28 L72 30 L54 46 L60 70 L40 56 L20 70 L26 46 L8 30 L31 28 Z" fill="${light}" opacity="0.18"/>`;
    case 'crown':
      return `<circle cx="40" cy="44" r="26" fill="${color}" stroke="${dark}" stroke-width="2"/><path d="M18 26 L24 16 L30 24 L40 14 L50 24 L56 16 L62 26 L62 32 L18 32 Z" fill="${light}" stroke="${dark}" stroke-width="1.5"/><circle cx="40" cy="14" r="2" fill="${dark}"/><circle cx="24" cy="16" r="1.5" fill="${dark}"/><circle cx="56" cy="16" r="1.5" fill="${dark}"/>`;
    case 'flame':
      return `<path d="M40 6 Q50 20 48 32 Q58 28 56 44 Q64 50 58 60 Q50 72 40 72 Q30 72 22 60 Q16 50 24 44 Q22 28 32 32 Q30 20 40 6 Z" fill="${color}" stroke="${dark}" stroke-width="2"/><path d="M40 6 Q50 20 48 32 Q58 28 56 44 Q64 50 58 60 Q50 72 40 72 Q30 72 22 60 Q16 50 24 44 Q22 28 32 32 Q30 20 40 6 Z" fill="${light}" opacity="0.2"/>`;
    case 'halo':
      return `<circle cx="40" cy="44" r="24" fill="${color}" stroke="${dark}" stroke-width="2"/><ellipse cx="40" cy="16" rx="18" ry="4" fill="none" stroke="${light}" stroke-width="2.5"/>`;
    /* v34: 通天教主 — 水晶八面体（通天彻地之晶） */
    case 'crystal':
      return `<path d="M40 6 L70 22 L70 58 L40 74 L10 58 L10 22 Z M40 6 L40 74 M10 22 L70 58 M70 22 L10 58" fill="${color}" stroke="${dark}" stroke-width="2"/><path d="M40 6 L70 22 L70 58 L40 74 L10 58 L10 22 Z" fill="${light}" opacity="0.18"/><path d="M40 6 L40 74 M10 22 L70 58 M70 22 L10 58" stroke="${light}" stroke-width="1.2" opacity="0.7"/>`;
    case 'round':
    default:
      return `<circle cx="40" cy="40" r="30" fill="${color}" stroke="${dark}" stroke-width="2"/><circle cx="40" cy="40" r="30" fill="${light}" opacity="0.15"/>`;
  }
}

/* 构造装饰图案（左下角小角标，体现个性） */
function accentPattern(accent, color, light, dark){
  switch(accent){
    case 'fan':
      return `<path d="M10 62 Q18 50 30 56 L26 66 Z" fill="${light}" opacity="0.85"/><path d="M14 60 L22 60 M16 58 L20 62" stroke="${dark}" stroke-width="0.8" opacity="0.6"/>`;
    case 'book':
      return `<rect x="9" y="55" width="15" height="11" rx="1" fill="${light}" opacity="0.85"/><path d="M16 55 L16 66" stroke="${dark}" stroke-width="0.8" opacity="0.6"/>`;
    case 'wave':
      return `<path d="M8 60 Q14 56 20 60 Q26 64 32 60" stroke="${light}" stroke-width="1.8" fill="none" opacity="0.85"/><path d="M8 65 Q14 61 20 65 Q26 69 32 65" stroke="${light}" stroke-width="1.4" fill="none" opacity="0.7"/>`;
    case 'spark':
      return `<path d="M14 58 L16 50 L18 58 L26 60 L18 62 L16 70 L14 62 L6 60 Z" fill="${light}" opacity="0.9"/>`;
    case 'note':
      return `<g fill="${light}" opacity="0.9"><circle cx="13" cy="63" r="3.5"/><rect x="15.5" y="49" width="1.6" height="15"/></g>`;
    case 'ball':
      return `<circle cx="15" cy="60" r="5.5" fill="${light}" opacity="0.9"/><path d="M15 54.5 L15 65.5 M9.5 60 L20.5 60 M11 56 L19 64 M19 56 L11 64" stroke="${dark}" stroke-width="0.7" opacity="0.7"/>`;
    case 'sword':
      return `<path d="M10 68 L18 50 L21 52 L13 70 Z" fill="${light}" opacity="0.9"/><rect x="16" y="66" width="6" height="1.6" fill="${dark}" opacity="0.7" transform="rotate(-30 19 67)"/>`;
    case 'grid':
      return `<g stroke="${light}" stroke-width="1" opacity="0.7"><path d="M8 55 L24 55 M8 60 L24 60 M8 65 L24 65 M12 51 L12 69 M16 51 L16 69 M20 51 L20 69"/></g>`;
    case 'code':
      return `<path d="M9 55 L14 60 L9 65 M24 55 L19 60 L24 65" stroke="${light}" stroke-width="1.8" fill="none" opacity="0.9"/><circle cx="16.5" cy="60" r="1.2" fill="${light}" opacity="0.9"/>`;
    case 'pen':
      return `<path d="M10 68 L18 52 L21 54 L13 70 Z" fill="${light}" opacity="0.9"/><path d="M18 52 L21 54" stroke="${dark}" stroke-width="0.8"/>`;
    case 'halo':
      return `<g stroke="${light}" stroke-width="1.6" opacity="0.85"><path d="M40 2 L40 8 M27 5 L30 10 M53 5 L50 10 M16 12 L21 16 M64 12 L59 16 M8 24 L13 26 M72 24 L67 26"/></g>`;
    case 'flame':
      return `<path d="M64 60 Q67 50 62 46 Q70 48 70 58 Q67 66 64 60 Z" fill="${light}" opacity="0.9"/><path d="M58 64 Q61 56 57 53 Q63 55 63 62 Q61 68 58 64 Z" fill="${light}" opacity="0.7"/>`;
    case 'table':
      return `<rect x="9" y="59" width="15" height="3" fill="${light}" opacity="0.9"/><path d="M11 62 L9 70 M22 62 L24 70" stroke="${light}" stroke-width="1.6" opacity="0.9"/>`;
    case 'snow':
      return `<g stroke="${light}" stroke-width="1.3" opacity="0.9"><path d="M16 52 L16 68 M8 60 L24 60 M10 54 L22 66 M22 54 L10 66"/></g>`;
    case 'mountain':
      return `<path d="M7 67 L16 53 L22 62 L28 50 L35 67 Z" fill="${light}" opacity="0.9"/><path d="M16 53 L19 57 L22 62" stroke="${dark}" stroke-width="0.7" opacity="0.5"/>`;
    case 'mist':
      return `<g stroke="${light}" stroke-width="1.4" fill="none" opacity="0.8"><path d="M7 57 Q14 53 21 57 Q28 61 35 57"/><path d="M9 63 Q16 59 23 63 Q30 67 37 63"/><path d="M7 69 Q14 65 21 69 Q28 73 35 69"/></g>`;
    case 'blade':
      return `<path d="M9 68 L20 52 L23 54 L12 70 Z" fill="${light}" opacity="0.9"/><path d="M23 68 L12 52 L9 54 L20 70 Z" fill="${light}" opacity="0.9"/>`;
    case 'lotus':
      return `<path d="M16 66 Q11 58 16 53 Q21 58 16 66 Z" fill="${light}" opacity="0.9"/><path d="M22 68 Q17 60 22 55 Q27 60 22 68 Z" fill="${light}" opacity="0.75"/><path d="M10 68 Q5 60 10 55 Q15 60 10 68 Z" fill="${light}" opacity="0.75"/>`;
    /* v34: 通天教主 — 诛仙雷霆（闪电图案） */
    case 'thunder':
      return `<path d="M20 52 L14 64 L18 64 L12 72 L24 60 L20 60 L26 52 Z" fill="${light}" opacity="0.95"/><path d="M28 56 L24 64 L28 64 L24 72" stroke="${light}" stroke-width="1.4" fill="none" opacity="0.8"/>`;
    default:
      return `<circle cx="15" cy="60" r="3.5" fill="${light}" opacity="0.75"/>`;
  }
}

/* 构造完整 SVG 头像字符串 */
function getPortraitSvg(id, color, glow){
  const ch = CHARACTERS[id];
  /* 兜底：未匹配角色时返回纯圆形 + 首字 */
  if(!ch){
    const c = color || '#1a1714';
    const char = (id||'?').charAt(0).toUpperCase();
    return `<svg viewBox="0 0 80 80" class="portrait-svg" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="32" fill="${c}" opacity="0.85"/><text x="40" y="51" text-anchor="middle" font-size="32" fill="#fff" font-family="serif" font-weight="bold">${char}</text></svg>`;
  }
  const c = color || ch.color || '#1a1714';
  const char = ch.char || (id.charAt(0).toUpperCase());
  const glowColor = glow || ch.glow || c;
  const style = PORTRAIT_STYLES[id] || { shape:'round', accent:'dot' };
  const light = lighten(c, 55);
  const dark = darken(c, 40);

  return `<svg viewBox="0 0 80 80" class="portrait-svg" xmlns="http://www.w3.org/2000/svg">
<circle cx="40" cy="40" r="38" fill="${glowColor}" opacity="0.12"/>
<circle cx="40" cy="40" r="36" fill="none" stroke="${glowColor}" stroke-width="1.5" opacity="0.5"/>
${faceShape(style.shape, c, light, dark)}
${accentPattern(style.accent, c, light, dark)}
<text x="40" y="52" text-anchor="middle" font-size="30" fill="#ffffff" font-family="'STKaiti','KaiTi','SimSun','Microsoft YaHei',serif" font-weight="bold" stroke="${dark}" stroke-width="0.8" paint-order="stroke">${char}</text>
</svg>`;
}

/* 主入口：返回 SVG 字符串（取代旧的 <img> 标签） */
function getPortrait(id, color, glow){
  return getPortraitSvg(id, color, glow);
}
window.__getPortraitSvg__ = getPortraitSvg;

/* 设置对局界面头像：注入 SVG（取代旧的 background-image）
   v22: 保留 avatar-char span（id=player-avatar-char），避免 startNewGame
   第二次调用 setAvatarPortrait 后再访问 player-avatar-char 报 null */
function setAvatarPortrait(avatarEl, charId){
  if(!avatarEl || !charId || !CHARACTERS[charId]) return;
  const ch = CHARACTERS[charId];
  const charText = ch.char || (charId.charAt(0).toUpperCase());
  /* 保留可能存在的旧 .avatar-char（含 id=player-avatar-char），避免 DOM 丢失 */
  const existingChar = avatarEl.querySelector('.avatar-char');
  if(existingChar){
    /* 仅更新 SVG，保留原 span（及其 id） */
    existingChar.textContent = charText;
    /* 移除旧的 portrait-svg，再注入新 SVG */
    avatarEl.querySelectorAll('.portrait-svg').forEach(el=>el.remove());
    avatarEl.insertAdjacentHTML('beforeend', getPortraitSvg(charId));
  } else {
    /* 没有 .avatar-char：重新构造完整结构 */
    avatarEl.innerHTML = `<span class="avatar-char">${charText}</span>${getPortraitSvg(charId)}`;
  }
  avatarEl.classList.add('has-portrait');
}
function clearAvatarPortrait(avatarEl){
  if(!avatarEl) return;
  avatarEl.innerHTML='';
  avatarEl.classList.remove('has-portrait');
}
