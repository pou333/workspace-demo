/*
 * Пятничный деплой — мини-аркада: баги ползут в прод, а у тебя только тапок.
 * Без зависимостей и сборки: всё рисуется на <canvas>, звук синтезируется через WebAudio.
 */
(() => {
  'use strict';

  // ---------- Утилиты ----------
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
  const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const angleDiff = (a, b) => {
    let d = (a - b) % TAU;
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;
    return d;
  };
  // Детерминированный «шум»: мигание лампочек и форма трещин не должны дрожать каждый кадр.
  const hash = (a, b) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const MONO = '"JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, monospace';

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Хранилище недоступно (приватный режим) — играем без сохранений.
      }
    },
  };
  const KEY_BEST = 'friday-deploy:best';
  const KEY_MUTED = 'friday-deploy:muted';

  // ---------- Тексты ----------
  const TXT = {
    squash: ['Шлёп!', 'Хрусть!', 'Пофиксил!', 'LGTM', 'Ship it!', 'Хотфикс', 'Тикет закрыт', 'Работает же!', 'Минус баг', 'Тесты? Какие тесты?', '+1 в резюме', 'Закоммитил'],
    legacyHit: ['Кто это писал?!', 'Легаси сопротивляется', 'Не трогай, оно работает', 'Тут нет тестов...'],
    legacyKill: ['Отрефакторил!', 'Легаси повержено', 'Переписал с нуля'],
    split: ['Пофиксил один — стало два', 'Фикс породил баги', 'Ой. Их стало больше'],
    heisenKill: ['Поймал гейзенбаг!', 'Воспроизвёл!', 'Попался!'],
    heisenDodge: ['У меня не воспроизводится', 'Хе-хе', '?!'],
    featureBroken: ['Это была фича!', 'Сломал фичу!', 'Продакт плачет', 'Заказчик в ярости'],
    featureShipped: ['Фича в проде!', 'Релиз!', 'Продакт доволен'],
    incident: ['ИНЦИДЕНТ!', '500!', 'Прод горит!', 'Алерт!', 'Даунтайм!'],
    revert: ['git revert HEAD', 'git reset --hard', 'Откатили!', 'Ctrl+Z на проде'],
    sprint: ['Заказчик передумал', 'Дедлайн перенесли на вчера', 'Тимлид ушёл в отпуск', 'Обновили все зависимости', 'Пришёл новый стажёр', 'Включили strict mode', 'Переезжаем на микросервисы', 'Переписываем на Rust', 'Тесты отключили «временно»', 'До выходных совсем чуть-чуть'],
    causes: [
      'Причина: деплой в пятницу в 17:59.',
      'Причина: «у меня на машине работало».',
      'Причина: кэш. Это всегда кэш.',
      'Причина: DNS. Это всегда DNS.',
      'Причина: часовые пояса. Опять.',
      'Причина: регулярка, которую никто не понимает.',
      'Причина: null. Просто null.',
      'Причина: off-by-one. Или off-by-two.',
      'Причина: кто-то обновил left-pad.',
      'Причина: тесты были, но их закомментировали.',
      'Причина: git push --force в main.',
      'Причина: «быстренько поправлю прямо на проде».',
    ],
    fixes: [
      'Решение: перезагрузили и сделали вид, что так и было.',
      'Решение: добавили ещё один console.log.',
      'Решение: запретили деплои по пятницам (до следующей пятницы).',
      'Решение: написать тесты. Когда-нибудь.',
      'Решение: переписать всё на Rust.',
      'Решение: откатились и ушли на выходные.',
      'Решение: завели тикет «разобраться». Приоритет: низкий.',
    ],
  };
  const COMBO_MILESTONES = { 5: 'Комбо!', 10: '10x инженер!', 20: 'Рок-звезда!', 30: 'Это кто, Линус?!', 50: 'Компилятор в шоке' };
  const SPRINT_NEWS = {
    2: 'Новое: размножатор и фичи. Фичи не бить!',
    3: 'Новое: легаси, нужно три удара',
    4: 'Новое: гейзенбаг, убегает от тапка',
  };
  const RANKS = [[16000, 'Легенда прода'], [10000, 'CTO'], [6000, 'Архитектор'], [3500, 'Тимлид'], [1800, 'Сеньор'], [800, 'Мидл'], [300, 'Джун'], [0, 'Стажёр']];
  const rankFor = (score) => RANKS.find(([min]) => score >= min)[1];

  // Фон — «редактор» с кодом, который и породил всех этих багов.
  const CODE = [
    '// deploy.js — не трогать по пятницам',
    "import { prod } from './infra';",
    "import { hope } from 'node:faith';",
    '',
    "const DEADLINE = new Date('вчера');",
    'const COFFEE_LEVEL = 0.03;',
    '',
    'export async function deploy(build) {',
    '  // TODO: написать тесты (2019)',
    '  if (worksOnMyMachine(build)) {',
    '    await prod.push(build, { force: true });',
    '  }',
    '  try {',
    '    await migrateDatabase({ backup: false });',
    '  } catch (e) {',
    '    // не сегодня',
    '  }',
    '  return hope();',
    '}',
    '',
    'function fixBug(bug) {',
    '  const newBugs = [bug.clone(), bug.clone()];',
    '  return newBugs; // временно',
    '}',
    '',
    'while (!coffee.isEmpty()) {',
    '  writeCode({ quality: Math.random() });',
    '}',
    '',
    '// магия. не понимаю, но работает',
    'const answer = 42;',
    "if (answer !== 42) throw new Error('вселенная сломалась');",
    '',
    'class Feature extends Bug {',
    "  constructor() { super('это не баг'); }",
    '}',
    '',
    'setTimeout(fixLater, Infinity);',
    'const reviewers = []; // LGTM',
    '',
    '// git push --force  # пятница, 17:58',
    'export default legacy;',
    '',
  ];
  const KEYWORDS = new Set(['import', 'from', 'export', 'default', 'async', 'await', 'function', 'const', 'let', 'if', 'else', 'try', 'catch', 'return', 'while', 'new', 'class', 'extends', 'constructor', 'super', 'throw', 'true', 'false', 'null']);

  // ---------- Баланс ----------
  const TYPES = {
    bug: { size: 13, hp: 1, speed: 62, points: 10, damage: 10, shell: '#ff4d5e', dark: '#5a0d18', goo: '#a3d65c' },
    hydra: { size: 17, hp: 1, speed: 48, points: 15, damage: 10, shell: '#ffc93c', dark: '#3d2800', goo: '#ffe08a' },
    legacy: { size: 25, hp: 3, speed: 30, points: 40, damage: 25, shell: '#9c8a7a', dark: '#2e241d', goo: '#8d7b68' },
    heisen: { size: 13, hp: 1, speed: 54, points: 30, damage: 12, shell: '#b892ff', dark: '#2a1259', goo: '#d4b8ff' },
    feature: { size: 15, hp: 1, speed: 44, points: 25, damage: 0, shell: '#5ef08f', dark: '#0b4d2a', goo: '#5ef08f' },
  };
  const LEVEL_TIME = 25; // секунд в спринте
  const COMBO_WINDOW = 1.6; // секунд между ударами, пока комбо не сгорело
  const SLIPPER_R = 24; // радиус удара тапком
  const MAX_CHARGES = 3;
  const CHARGE_EVERY = 1500; // очков за новый git revert
  const DYING_TIME = 1.4;
  const DEMO_WEIGHTS = { bug: 40, hydra: 15, legacy: 12, heisen: 13, feature: 20 };

  function weightsFor(level) {
    if (level <= 1) return { bug: 1 };
    if (level === 2) return { bug: 70, hydra: 20, feature: 10 };
    if (level === 3) return { bug: 55, hydra: 18, feature: 12, legacy: 15 };
    return { bug: 45, hydra: 16, feature: 12, legacy: 13, heisen: 14 };
  }

  function pickType(weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = Math.random() * total;
    for (const k in weights) {
      r -= weights[k];
      if (r <= 0) return k;
    }
    return 'bug';
  }

  const comboMult = (combo) => Math.min(5, 1 + Math.floor(combo / 5));

  // ---------- Звук ----------
  const audio = {
    ctx: null,
    master: null,
    noiseBuf: null,
    muted: store.get(KEY_MUTED, false),
    init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    setMuted(muted) {
      this.muted = muted;
      store.set(KEY_MUTED, muted);
      if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    },
    tone(freq, dur, { type = 'square', vol = 0.1, slide = 0, delay = 0 } = {}) {
      const ac = this.ctx;
      if (!ac || this.muted) return;
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    },
    noise(dur, { vol = 0.2, freq = 1000, delay = 0 } = {}) {
      const ac = this.ctx;
      if (!ac || this.muted) return;
      if (!this.noiseBuf) {
        this.noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      const t0 = ac.currentTime + delay;
      const src = ac.createBufferSource();
      const filter = ac.createBiquadFilter();
      const gain = ac.createGain();
      src.buffer = this.noiseBuf;
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter).connect(gain).connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    },
  };

  const sfx = {
    squash() { audio.noise(0.09, { vol: 0.35, freq: 900 }); audio.tone(170, 0.09, { vol: 0.08, slide: -110 }); },
    hit() { audio.tone(420, 0.06, { type: 'triangle', vol: 0.12 }); audio.noise(0.04, { vol: 0.15, freq: 2000 }); },
    miss() { audio.noise(0.06, { vol: 0.08, freq: 2600 }); },
    split() { audio.tone(330, 0.07, { vol: 0.07 }); audio.tone(495, 0.07, { vol: 0.07, delay: 0.06 }); },
    feature() { audio.tone(740, 0.35, { type: 'sawtooth', vol: 0.07, slide: -520 }); },
    shipped() { audio.tone(660, 0.08, { type: 'triangle', vol: 0.1 }); audio.tone(990, 0.12, { type: 'triangle', vol: 0.1, delay: 0.07 }); },
    incident() { audio.tone(880, 0.14, { vol: 0.08 }); audio.tone(587, 0.2, { vol: 0.08, delay: 0.15 }); },
    teleport() { audio.tone(1300, 0.08, { type: 'sine', vol: 0.06, slide: 900 }); },
    revert() { audio.tone(140, 0.7, { type: 'sine', vol: 0.25, slide: 1100 }); audio.noise(0.6, { vol: 0.25, freq: 500 }); },
    level() { [523, 659, 784, 1047].forEach((f, i) => audio.tone(f, 0.12, { type: 'triangle', vol: 0.1, delay: i * 0.08 })); },
    bonus() { audio.tone(880, 0.1, { type: 'triangle', vol: 0.1 }); audio.tone(1320, 0.15, { type: 'triangle', vol: 0.1, delay: 0.08 }); },
    over() { audio.tone(440, 1.0, { type: 'sawtooth', vol: 0.08, slide: -330 }); audio.noise(0.8, { vol: 0.2, freq: 300 }); },
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const bg = document.createElement('canvas');
  const ui = {
    hud: $('hud'),
    score: $('score'),
    sprint: $('sprint'),
    combo: $('combo'),
    uptimeFill: $('uptimeFill'),
    uptimeText: $('uptimeText'),
    charges: $('charges'),
    revertBtn: $('revertBtn'),
    pauseBtn: $('pauseBtn'),
    muteBtn: $('muteBtn'),
    menu: $('menu'),
    pause: $('pause'),
    over: $('over'),
    startBtn: $('startBtn'),
    resumeBtn: $('resumeBtn'),
    restartBtn: $('restartBtn'),
    menuBest: $('menuBest'),
    incidentNo: $('incidentNo'),
    postmortem: $('postmortem'),
    statScore: $('statScore'),
    statBest: $('statBest'),
    statTime: $('statTime'),
    statSquashed: $('statSquashed'),
    statFeatures: $('statFeatures'),
    statCombo: $('statCombo'),
    rank: $('rank'),
    newRecord: $('newRecord'),
  };
  const ICONS = {
    on: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };

  // ---------- Состояние ----------
  let W = 0;
  let H = 0;
  let dpr = 1;
  let prodTop = 0;
  let state = 'menu'; // menu | playing | paused | dying | over
  let time = 0;
  let game = null;
  let best = store.get(KEY_BEST, 0);
  let bugs = [];
  let spawnQueue = [];
  let particles = [];
  let splats = [];
  let texts = [];
  let rings = [];
  let banner = null;
  let shake = 0;
  let flash = 0;
  let alarm = 0;
  let demoTimer = 0;
  let lastQuip = 0;
  const pointer = { x: 0, y: 0, visible: false, hideAt: 0 };
  const slipper = { press: 0 };
  const legend = [];
  const hudCache = {};
  const hudBump = { score: false, combo: false };

  function newGame() {
    return {
      score: 0,
      shownScore: 0,
      uptime: 100,
      level: 1,
      levelTime: 0,
      spawnTimer: 0.8,
      spawnInterval: 1.25,
      speedMult: 1,
      combo: 0,
      comboTimer: 0,
      maxCombo: 0,
      charges: 1,
      nextChargeAt: CHARGE_EVERY,
      squashed: 0,
      featuresBroken: 0,
      elapsed: 0,
      wave: null,
      dyingT: 0,
    };
  }

  // ---------- Размеры и фон ----------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    prodTop = H - clamp(H * 0.11, 64, 96);
    buildBackground();
  }

  function buildBackground() {
    bg.width = Math.round(W * dpr);
    bg.height = Math.round(H * dpr);
    const c = bg.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#141722';
    c.fillRect(0, 0, W, H);
    const gutter = 52;
    const lineHeight = 22;
    c.fillStyle = '#10121b';
    c.fillRect(0, 0, gutter, H);
    c.font = `13px ${MONO}`;
    c.textBaseline = 'middle';
    const start = randInt(0, CODE.length - 1);
    for (let i = 0; i * lineHeight < H; i++) {
      const y = 12 + i * lineHeight + lineHeight / 2;
      c.textAlign = 'right';
      c.fillStyle = 'rgba(139,147,179,0.28)';
      c.fillText(String(i + 1), gutter - 12, y);
      c.textAlign = 'left';
      drawCodeLine(c, CODE[(start + i) % CODE.length], gutter + 16, y);
    }
    const vignette = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = vignette;
    c.fillRect(0, 0, W, H);
  }

  // Примитивная подсветка синтаксиса: комментарии, строки, числа, ключевые слова, вызовы.
  function drawCodeLine(c, line, x, y) {
    const re = /(\/\/.*$)|('[^']*'|"[^"]*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g;
    let cx = x;
    let m;
    while ((m = re.exec(line))) {
      const [tok, comment, str, num, ident, space] = m;
      if (!space) {
        let color = 'rgba(205,214,244,0.36)';
        if (comment) color = 'rgba(127,132,156,0.5)';
        else if (str) color = 'rgba(166,227,161,0.45)';
        else if (num) color = 'rgba(250,179,135,0.5)';
        else if (ident && KEYWORDS.has(ident)) color = 'rgba(203,166,247,0.5)';
        else if (ident && line[re.lastIndex] === '(') color = 'rgba(137,180,250,0.5)';
        c.fillStyle = color;
        c.fillText(tok, cx, y);
      }
      cx += c.measureText(tok).width;
    }
  }

  // ---------- Баги ----------
  function makeBug(type, x, y, speedMult, small = false) {
    const T = TYPES[type];
    return {
      type,
      x,
      y,
      small,
      size: T.size * (small ? 0.72 : 1),
      hp: T.hp,
      maxHp: T.hp,
      speed: T.speed * speedMult * rand(0.85, 1.15) * (small ? 1.3 : 1),
      angle: Math.PI / 2,
      seed: rand(0, 1000),
      wobbleAmp: rand(0.2, 0.65),
      wobbleFreq: rand(0.7, 1.6),
      legPhase: rand(0, TAU),
      wing: rand(0, TAU),
      flash: 0,
      grow: 0,
      invuln: 0,
      teleportCd: 0.8,
      dead: false,
    };
  }

  function spawnBug(type, speedMult, fromSides) {
    let x = rand(40, W - 40);
    let y = -30;
    let angle = Math.PI / 2;
    if (fromSides && Math.random() < 0.22) {
      const left = Math.random() < 0.5;
      x = left ? -30 : W + 30;
      y = rand(90, prodTop * 0.45);
      angle = left ? 0.35 : Math.PI - 0.35;
    }
    const b = makeBug(type, x, y, speedMult);
    b.angle = angle;
    bugs.push(b);
  }

  function updateBug(b, dt, playing) {
    b.flash = Math.max(0, b.flash - dt);
    b.invuln = Math.max(0, b.invuln - dt);
    b.teleportCd = Math.max(0, b.teleportCd - dt);
    b.grow = Math.min(1, b.grow + dt * 3.5);

    let target = Math.PI / 2 + Math.sin(time * b.wobbleFreq + b.seed) * b.wobbleAmp;
    if (b.type === 'feature') {
      b.wing += dt * 16;
      target = Math.PI / 2 + Math.sin(time * 1.9 + b.seed) + Math.sin(time * 4.7 + b.seed * 3) * 0.45;
    }
    if (b.x < 34) target = Math.PI / 2 - 0.8;
    else if (b.x > W - 34) target = Math.PI / 2 + 0.8;
    b.angle += angleDiff(target, b.angle) * Math.min(1, dt * 3);

    if (b.type === 'heisen' && b.teleportCd === 0) {
      const near = playing && pointer.visible && Math.hypot(pointer.x - b.x, pointer.y - b.y) < 90;
      if (near || Math.random() < dt * 0.2) teleport(b, near, playing);
    }

    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.legPhase += b.speed * dt * 0.28;
  }

  function teleport(b, dodged, playing) {
    poof(b.x, b.y);
    const a = rand(0, TAU);
    const d = rand(110, 170);
    b.x = clamp(b.x + Math.cos(a) * d, 40, W - 40);
    b.y = clamp(b.y + Math.sin(a) * d, 50, Math.max(50, prodTop - 70));
    b.teleportCd = 1.3;
    b.grow = 0.35;
    poof(b.x, b.y);
    if (playing) {
      sfx.teleport();
      if (dodged && Math.random() < 0.35) say(b.x, b.y - 24, pick(TXT.heisenDodge), '#d4b8ff', 14);
    }
  }

  // ---------- Игровые события ----------
  function swat(x, y) {
    slipper.press = 1;
    rings.push({ x, y, r: 8, life: 0.28, max: 0.28, color: '#ffffff' });
    if (state !== 'playing') return;
    let hits = 0;
    for (const b of bugs) {
      if (b.dead || b.invuln > 0) continue;
      if (Math.hypot(b.x - x, b.y - y) > b.size * 0.9 + SLIPPER_R) continue;
      hits++;
      if (b.type === 'feature') {
        breakFeature(b);
        continue;
      }
      b.hp--;
      b.flash = 0.12;
      if (b.hp <= 0) {
        killBug(b, false);
      } else {
        sfx.hit();
        shake = Math.max(shake, 4);
        burst(b.x, b.y, 8, [TYPES[b.type].shell, '#ffffff'], { speed: [40, 160], life: [0.2, 0.45] });
        say(b.x, b.y - b.size - 14, pick(TXT.legacyHit), '#ffd8b0', 14);
      }
    }
    if (hits === 0) {
      game.combo = 0;
      sfx.miss();
      burst(x, y, 5, ['rgba(255,255,255,0.6)'], { speed: [30, 90], life: [0.15, 0.3], size: [1, 2] });
    }
    flushSpawnQueue();
  }

  function flushSpawnQueue() {
    if (!spawnQueue.length) return;
    bugs.push(...spawnQueue);
    spawnQueue = [];
  }

  function killBug(b, byRevert) {
    b.dead = true;
    const T = TYPES[b.type];
    addSplat(b.x, b.y, b.size, T.goo);
    burst(b.x, b.y, b.type === 'legacy' ? 26 : 14, [T.goo, T.shell, T.dark], { speed: [60, 260], size: [1.5, 4.5], life: [0.35, 0.9] });

    let mult = 1;
    if (!byRevert) {
      game.combo++;
      game.comboTimer = COMBO_WINDOW;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      hudBump.combo = true;
      mult = comboMult(game.combo);
      const milestone = COMBO_MILESTONES[game.combo];
      if (milestone) {
        say(W / 2, H * 0.34, `${milestone} x${mult}`, '#ffd166', 30, 1.4);
        sfx.bonus();
      }
    }
    const pts = Math.round(T.points * (b.small ? 0.6 : 1)) * mult;
    addScore(pts);
    game.squashed++;
    say(b.x, b.y - b.size - 6, `+${pts}`, mult > 1 ? '#ffd166' : '#ffffff', 15, 0.8);

    // Откат удаляет баг целиком, поэтому размножатор делится только от тапка.
    if (b.type === 'hydra' && !b.small && !byRevert) {
      for (const side of [-1, 1]) {
        const kid = makeBug('hydra', b.x + side * 10, b.y, game.speedMult, true);
        kid.angle = Math.PI / 2 + side * 0.9;
        kid.invuln = 0.35;
        kid.grow = 0.2;
        spawnQueue.push(kid);
      }
      say(b.x, b.y + 28, pick(TXT.split), '#ffe08a', 14);
      sfx.split();
    } else if (!byRevert) {
      let quip = null;
      if (b.type === 'legacy') quip = pick(TXT.legacyKill);
      else if (b.type === 'heisen') quip = pick(TXT.heisenKill);
      else if (time - lastQuip > 0.9 && Math.random() < 0.3) quip = pick(TXT.squash);
      if (quip) {
        lastQuip = time;
        say(b.x, b.y + b.size + 18, quip, '#e6e9f5', 14);
      }
    }
    if (!byRevert) sfx.squash();
    shake = Math.max(shake, b.type === 'legacy' ? 7 : 3);
  }

  function breakFeature(b) {
    b.dead = true;
    addSplat(b.x, b.y, b.size, TYPES.feature.goo);
    burst(b.x, b.y, 18, ['#5ef08f', '#b9ffd2', '#ffffff'], { speed: [60, 240], life: [0.35, 0.8] });
    game.score = Math.max(0, game.score - 50);
    game.combo = 0;
    game.featuresBroken++;
    say(b.x, b.y - 26, pick(TXT.featureBroken), '#ff6b7a', 18, 1.2);
    say(b.x, b.y - 4, '-50', '#ff6b7a', 15, 0.9);
    sfx.feature();
    shake = Math.max(shake, 6);
    flash = Math.max(flash, 0.35);
    hurt(6);
  }

  function reachProd(b) {
    b.dead = true;
    if (state !== 'playing') {
      burst(b.x, prodTop, 6, [TYPES[b.type].shell], { speed: [40, 120], life: [0.2, 0.4], angle: [-Math.PI, 0] });
      return;
    }
    if (b.type === 'feature') {
      addScore(25);
      say(b.x, prodTop - 26, `${pick(TXT.featureShipped)} +25`, '#5ef08f', 16, 1.1);
      burst(b.x, prodTop, 14, ['#5ef08f', '#ffffff'], { speed: [80, 220], life: [0.4, 0.8], angle: [-Math.PI, 0] });
      sfx.shipped();
      return;
    }
    game.combo = 0;
    shake = Math.max(shake, 11);
    flash = Math.max(flash, 0.6);
    alarm = 1.2;
    burst(b.x, prodTop, 24, ['#ffb347', '#ff5f6d', '#fff3b0'], { speed: [120, 380], size: [1.5, 4], life: [0.4, 1], gravity: 500, angle: [-Math.PI, 0] });
    say(b.x, prodTop - 30, pick(TXT.incident), '#ff4d5e', 22, 1.2);
    sfx.incident();
    hurt(TYPES[b.type].damage * (b.small ? 0.6 : 1));
  }

  function hurt(amount) {
    game.uptime = Math.max(0, game.uptime - amount);
    if (game.uptime <= 0 && state === 'playing') startDying();
  }

  function addScore(pts) {
    game.score += pts;
    hudBump.score = true;
    while (game.score >= game.nextChargeAt) {
      game.nextChargeAt += CHARGE_EVERY;
      if (game.charges < MAX_CHARGES) {
        game.charges++;
        say(W / 2, H * 0.4, 'Новый git revert! [пробел]', '#7dd3fc', 20, 1.4);
        sfx.bonus();
      }
    }
  }

  function revert() {
    if (state !== 'playing' || game.charges <= 0 || game.wave) return;
    game.charges--;
    const x = pointer.visible ? pointer.x : W / 2;
    const y = pointer.visible ? pointer.y : H / 2;
    game.wave = { x, y, r: 0, max: Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 40 };
    say(W / 2, H * 0.3, pick(TXT.revert), '#7dd3fc', 34, 1.4);
    sfx.revert();
    shake = Math.max(shake, 9);
  }

  function updateWave(dt) {
    const w = game.wave;
    w.r += 1300 * dt;
    for (const b of bugs) {
      if (!b.dead && b.type !== 'feature' && Math.hypot(b.x - w.x, b.y - w.y) < w.r) killBug(b, true);
    }
    if (w.r > w.max) game.wave = null;
  }

  function nextLevel() {
    game.level++;
    game.levelTime = 0;
    game.spawnInterval = Math.max(0.3, 1.25 * 0.86 ** (game.level - 1));
    game.speedMult = Math.min(2.4, 1 + 0.11 * (game.level - 1));
    game.uptime = Math.min(100, game.uptime + 5);
    showBanner(`Спринт ${game.level}`, SPRINT_NEWS[game.level] || pick(TXT.sprint), 'ретро прошло: аптайм +5%');
    sfx.level();
  }

  // ---------- Эффекты ----------
  function burst(x, y, n, colors, o = {}) {
    const [s0, s1] = o.speed || [60, 220];
    const [z0, z1] = o.size || [1.5, 4];
    const [l0, l1] = o.life || [0.3, 0.8];
    const [a0, a1] = o.angle || [0, TAU];
    for (let i = 0; i < n; i++) {
      const a = rand(a0, a1);
      const speed = rand(s0, s1);
      const life = rand(l0, l1);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        size: rand(z0, z1),
        life,
        max: life,
        color: pick(colors),
        gravity: o.gravity || 0,
        drag: o.drag ?? 3,
      });
    }
    if (particles.length > 900) particles.splice(0, particles.length - 900);
  }

  function poof(x, y) {
    burst(x, y, 10, [TYPES.heisen.shell, '#ffffff'], { speed: [30, 120], life: [0.25, 0.5], size: [1, 3] });
    rings.push({ x, y, r: 4, life: 0.3, max: 0.3, color: TYPES.heisen.shell });
  }

  function addSplat(x, y, size, color) {
    const pts = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const r = size * rand(0.7, 1.35);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const drops = [];
    for (let i = randInt(3, 6); i > 0; i--) {
      const a = rand(0, TAU);
      const d = size * rand(1.5, 2.6);
      drops.push([Math.cos(a) * d, Math.sin(a) * d, rand(1.5, Math.max(2, size * 0.25))]);
    }
    splats.push({ x, y, pts, drops, color, life: 8 });
    if (splats.length > 80) splats.shift();
  }

  function say(x, y, text, color = '#ffffff', size = 16, life = 1) {
    ctx.font = `800 ${size}px ${SANS}`;
    // Запас на «вспышку» текста (масштаб до 1.35) и тряску экрана.
    const half = ctx.measureText(text).width * 0.68 + 12;
    texts.push({ x: clamp(x, half, Math.max(half, W - half)), y, text, color, size, life, max: life, vy: -40 });
    if (texts.length > 40) texts.shift();
  }

  function showBanner(title, sub, note = '') {
    banner = { title, sub, note, life: 2.8, max: 2.8 };
  }

  // ---------- Состояния игры ----------
  function startGame() {
    audio.init();
    game = newGame();
    bugs = [];
    spawnQueue = [];
    particles = [];
    splats = [];
    texts = [];
    rings = [];
    shake = 0;
    flash = 0;
    alarm = 0;
    state = 'playing';
    for (const key of Object.keys(hudCache)) delete hudCache[key];
    ui.menu.hidden = true;
    ui.over.hidden = true;
    ui.pause.hidden = true;
    ui.hud.hidden = false;
    showBanner('Спринт 1', 'Пятница, 17:59. Деплой пошёл', 'не пускай баги в прод');
    sfx.level();
  }

  function startDying() {
    state = 'dying';
    game.dyingT = DYING_TIME;
    game.wave = null;
    game.combo = 0;
    flash = 1;
    shake = 16;
    sfx.over();
  }

  function showGameOver() {
    state = 'over';
    const isRecord = game.score > best;
    if (isRecord) {
      best = game.score;
      store.set(KEY_BEST, best);
    }
    ui.incidentNo.textContent = `INC-${randInt(1000, 9999)}`;
    ui.postmortem.textContent = `${pick(TXT.causes)} ${pick(TXT.fixes)}`;
    ui.statScore.textContent = String(game.score);
    ui.statBest.textContent = String(best);
    ui.statTime.textContent = fmtTime(game.elapsed);
    ui.statSquashed.textContent = String(game.squashed);
    ui.statFeatures.textContent = String(game.featuresBroken);
    ui.statCombo.textContent = String(game.maxCombo);
    ui.rank.textContent = rankFor(game.score);
    ui.newRecord.hidden = !(isRecord && game.score > 0);
    ui.hud.hidden = true;
    ui.over.hidden = false;
    updateMenuBest();
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    ui.pause.hidden = false;
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    ui.pause.hidden = true;
  }

  function toggleMute() {
    audio.setMuted(!audio.muted);
    syncMuteButton();
  }

  function syncMuteButton() {
    ui.muteBtn.innerHTML = audio.muted ? ICONS.off : ICONS.on;
    ui.muteBtn.setAttribute('aria-pressed', String(audio.muted));
  }

  function updateMenuBest() {
    ui.menuBest.textContent = best > 0 ? `Рекорд: ${best} · ${rankFor(best)}` : 'Рекорда пока нет. Самое время.';
  }

  // ---------- Обновление ----------
  function update(dt) {
    if (state === 'paused') return;
    if (state === 'dying') {
      game.dyingT -= dt;
      if (game.dyingT <= 0) showGameOver();
      dt *= 0.3; // слоу-мо, пока прод падает
    }
    time += dt;
    const playing = state === 'playing';

    if (playing) {
      game.elapsed += dt;
      game.levelTime += dt;
      if (game.levelTime >= LEVEL_TIME) nextLevel();
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        spawnBug(pickType(weightsFor(game.level)), game.speedMult, game.level >= 3);
        if (game.level >= 3 && Math.random() < 0.08) {
          spawnBug('bug', game.speedMult, false);
          spawnBug('bug', game.speedMult, false);
        }
        game.spawnTimer = game.spawnInterval * rand(0.7, 1.3);
      }
      if (game.comboTimer > 0) {
        game.comboTimer -= dt;
        if (game.comboTimer <= 0) game.combo = 0;
      }
      if (game.wave) updateWave(dt);
    } else if (state === 'menu' || state === 'over') {
      // Пока открыто меню, баги ползают «для атмосферы» и никому не вредят.
      demoTimer -= dt;
      if (demoTimer <= 0) {
        if (bugs.length < 14) spawnBug(pickType(DEMO_WEIGHTS), 0.9, true);
        demoTimer = rand(0.6, 1.3);
      }
    }

    for (const b of bugs) {
      if (b.dead) continue;
      updateBug(b, dt, playing);
      if (b.y > prodTop + 6) reachProd(b);
    }
    flushSpawnQueue();
    bugs = bugs.filter((b) => !b.dead);

    for (const p of particles) {
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const s of splats) s.life -= dt;
    splats = splats.filter((s) => s.life > 0);
    for (const t of texts) {
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-2 * dt);
    }
    texts = texts.filter((t) => t.life > 0);
    for (const r of rings) {
      r.life -= dt;
      r.r += 160 * dt;
    }
    rings = rings.filter((r) => r.life > 0);
    if (banner) {
      banner.life -= dt;
      if (banner.life <= 0) banner = null;
    }
    shake = Math.max(0, shake - dt * 40);
    flash = Math.max(0, flash - dt * 1.6);
    alarm = Math.max(0, alarm - dt);
    slipper.press = Math.max(0, slipper.press - dt * 7);
    if (pointer.hideAt && performance.now() > pointer.hideAt) {
      pointer.visible = false;
      pointer.hideAt = 0;
    }
  }

  // ---------- Отрисовка ----------
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);

    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    for (const s of splats) drawSplat(s);
    ctx.globalAlpha = 1;
    drawProd();
    for (const b of bugs) drawBug(ctx, b);
    drawParticles();
    if (game && game.wave) drawWave(game.wave);
    drawRings();
    drawTexts();
    ctx.restore();

    drawScreenFx();
    if (banner) drawBanner();
    if (state === 'playing' && pointer.visible) drawSlipper(pointer.x, pointer.y);
  }

  function drawProd() {
    const h = H - prodTop;
    const danger = 0.1 + alarm * 0.25 + (game && state === 'playing' && game.uptime < 30 ? 0.08 * (1 + Math.sin(time * 6)) : 0);
    const glow = ctx.createLinearGradient(0, prodTop - 70, 0, prodTop);
    glow.addColorStop(0, 'rgba(255,77,94,0)');
    glow.addColorStop(1, `rgba(255,77,94,${danger})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, prodTop - 70, W, 70);
    ctx.fillStyle = '#0d0f17';
    ctx.fillRect(0, prodTop, W, h);
    ctx.fillStyle = `rgba(255,77,94,${0.55 + alarm * 0.35})`;
    ctx.fillRect(0, prodTop, W, 2);

    ctx.font = `700 11px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,120,130,0.9)';
    ctx.fillText('PRODUCTION · не ронять', 14, prodTop + 8);

    // Серверные стойки с мигающими лампочками.
    const rackW = 64;
    const gap = 14;
    const count = Math.max(1, Math.floor((W - 28 + gap) / (rackW + gap)));
    const top = prodTop + 26;
    const rackH = h - 34;
    let x = (W - (count * rackW + (count - 1) * gap)) / 2;
    for (let i = 0; i < count; i++, x += rackW + gap) {
      ctx.fillStyle = '#171a26';
      ctx.fillRect(x, top, rackW, rackH);
      for (let u = 0; top + 3 + u * 14 + 10 <= top + rackH; u++) {
        const uy = top + 3 + u * 14;
        ctx.fillStyle = '#20243a';
        ctx.fillRect(x + 3, uy, rackW - 6, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x + 7, uy + 4, 22, 2);
        for (let l = 0; l < 3; l++) {
          const on = hash(i * 31 + u * 7 + l, Math.floor(time * (2 + l))) > 0.3;
          if (alarm > 0) ctx.fillStyle = on ? '#ff4d5e' : '#4a1520';
          else ctx.fillStyle = on ? '#5ef08f' : '#173b27';
          ctx.fillRect(x + rackW - 10 - l * 6, uy + 4, 3, 3);
        }
      }
    }
  }

  function drawSplat(s) {
    ctx.globalAlpha = 0.5 * Math.min(1, s.life / 2);
    ctx.fillStyle = s.color;
    const p = s.pts;
    const n = p.length;
    ctx.beginPath();
    ctx.moveTo(s.x + (p[n - 1][0] + p[0][0]) / 2, s.y + (p[n - 1][1] + p[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const [x0, y0] = p[i];
      const [x1, y1] = p[(i + 1) % n];
      ctx.quadraticCurveTo(s.x + x0, s.y + y0, s.x + (x0 + x1) / 2, s.y + (y0 + y1) / 2);
    }
    ctx.fill();
    for (const [dx, dy, r] of s.drops) dot(ctx, s.x + dx, s.y + dy, r);
  }

  function drawBug(c, b) {
    const T = TYPES[b.type];
    const s = b.size * (0.4 + 0.6 * easeOutBack(b.grow));
    const flying = b.type === 'feature';
    const flap = 0.25 + 0.75 * Math.abs(Math.sin(b.wing));
    c.save();
    c.translate(b.x, b.y);
    if (b.type === 'heisen') c.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(time * 6 + b.seed));

    // Тень смещена в экранных координатах, поэтому рисуется до поворота тела.
    c.save();
    c.translate(flying ? 8 : 3, flying ? 12 : 4);
    c.rotate(b.angle);
    c.fillStyle = flying ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.35)';
    c.beginPath();
    if (flying) c.ellipse(0, 0, s * 0.8, s * 1.1 * flap + 1, 0, 0, TAU);
    else c.ellipse(-s * 0.1, 0, s * 1.05, s * 0.75, 0, 0, TAU);
    c.fill();
    c.restore();

    c.rotate(b.angle);
    if (flying) drawButterfly(c, s, T, flap);
    else drawBeetle(c, b, s, T);
    c.restore();
  }

  function drawBeetle(c, b, s, T) {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = T.dark;

    // Лапки ходят «треногой»: передняя и задняя с одной стороны вместе со средней с другой.
    c.lineWidth = Math.max(1.3, s * 0.13);
    for (let i = 0; i < 3; i++) {
      const bx = (1 - i) * s * 0.4;
      const reach = (1 - i) * s * 0.45;
      for (const side of [-1, 1]) {
        const swing = Math.sin(b.legPhase + (i + (side > 0 ? 1 : 0)) * Math.PI) * s * 0.28;
        c.beginPath();
        c.moveTo(bx, side * s * 0.3);
        c.lineTo(bx + reach * 0.6 + swing * 0.5, side * s * 0.95);
        c.lineTo(bx + reach + swing, side * s * 1.35);
        c.stroke();
      }
    }

    c.lineWidth = Math.max(1, s * 0.08);
    const sway = Math.sin(time * 8 + b.seed) * s * 0.12;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 0.95, side * s * 0.12);
      c.quadraticCurveTo(s * 1.35, side * s * 0.2 + sway, s * 1.55, side * s * 0.55 + sway * side);
      c.stroke();
    }

    if (b.type === 'heisen') {
      c.shadowColor = T.shell;
      c.shadowBlur = 14;
    }
    c.fillStyle = T.shell;
    c.lineWidth = Math.max(1, s * 0.1);
    c.beginPath();
    c.ellipse(-s * 0.15, 0, s * 0.85, s * 0.66, 0, 0, TAU);
    c.fill();
    c.shadowBlur = 0;
    c.stroke();

    c.fillStyle = T.dark;
    if (b.type === 'bug') {
      for (const [sx, sy] of [[-0.55, 0.32], [-0.1, 0.36], [0.2, 0.22]]) {
        dot(c, sx * s, sy * s, s * 0.13);
        dot(c, sx * s, -sy * s, s * 0.13);
      }
      dot(c, -0.85 * s, 0, s * 0.12);
    } else if (b.type === 'hydra') {
      c.save();
      c.beginPath();
      c.ellipse(-s * 0.15, 0, s * 0.85, s * 0.66, 0, 0, TAU);
      c.clip();
      for (const sx of [-0.8, -0.42, -0.04]) c.fillRect((sx - 0.08) * s, -s, s * 0.17, s * 2);
      c.restore();
    } else if (b.type === 'legacy') {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        dot(c, -s * 0.15 + Math.cos(a) * s * 0.68, Math.sin(a) * s * 0.5, Math.max(1, s * 0.05));
      }
      // Каждый пропущенный удар оставляет трещину.
      c.strokeStyle = 'rgba(20,12,8,0.8)';
      c.lineWidth = 1.4;
      for (let k = 0; k < b.maxHp - b.hp; k++) {
        let px = -s * 0.15;
        let py = 0;
        c.beginPath();
        c.moveTo(px, py);
        for (let j = 1; j <= 3; j++) {
          const a = b.seed + k * 2.4 + (hash(k, j) - 0.5) * 1.2;
          px += Math.cos(a) * s * 0.26;
          py += Math.sin(a) * s * 0.2;
          c.lineTo(px, py);
        }
        c.stroke();
      }
    }

    c.strokeStyle = T.dark;
    c.lineWidth = Math.max(1, s * 0.08);
    c.beginPath();
    c.moveTo(-s * 0.98, 0);
    c.lineTo(s * 0.42, 0);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath();
    c.ellipse(-s * 0.4, -s * 0.32, s * 0.32, s * 0.12, -0.25, 0, TAU);
    c.fill();

    if (b.type === 'legacy') uprightText(c, b, '1998', -s * 0.15, 0, `700 ${Math.round(s * 0.34)}px ${MONO}`, 'rgba(0,0,0,0.5)');
    if (b.type === 'heisen') uprightText(c, b, '?', -s * 0.15, 0, `800 ${Math.round(s * 0.95)}px ${SANS}`, 'rgba(255,255,255,0.9)');

    c.fillStyle = T.dark;
    c.beginPath();
    c.ellipse(s * 0.62, 0, s * 0.3, s * 0.42, 0, 0, TAU);
    c.fill();
    dot(c, s * 0.92, 0, s * 0.24);
    c.fillStyle = '#ffffff';
    dot(c, s * 1.02, -s * 0.12, s * 0.06 + 0.6);
    dot(c, s * 1.02, s * 0.12, s * 0.06 + 0.6);

    if (b.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${(b.flash / 0.12) * 0.85})`;
      c.beginPath();
      c.ellipse(-s * 0.15, 0, s * 0.85, s * 0.66, 0, 0, TAU);
      c.fill();
    }
  }

  function drawButterfly(c, s, T, flap) {
    c.shadowColor = 'rgba(94,240,143,0.8)';
    c.shadowBlur = 14;
    c.fillStyle = 'rgba(94,240,143,0.92)';
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(s * 0.2, side * s * 0.62 * flap, s * 0.62, s * 0.55 * flap + 1, side * 0.5, 0, TAU);
      c.fill();
    }
    c.fillStyle = 'rgba(38,191,105,0.92)';
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(-s * 0.45, side * s * 0.45 * flap, s * 0.45, s * 0.4 * flap + 1, -side * 0.4, 0, TAU);
      c.fill();
    }
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,0.6)';
    for (const side of [-1, 1]) dot(c, s * 0.35, side * s * 0.7 * flap, s * 0.12 * (0.5 + flap / 2));
    c.fillStyle = T.dark;
    c.beginPath();
    c.ellipse(0, 0, s * 0.85, s * 0.16, 0, 0, TAU);
    c.fill();
    dot(c, s * 0.85, 0, s * 0.18);
    c.strokeStyle = T.dark;
    c.lineWidth = 1.2;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 0.9, side * s * 0.08);
      c.quadraticCurveTo(s * 1.25, side * s * 0.12, s * 1.45, side * s * 0.45);
      c.stroke();
      dot(c, s * 1.45, side * s * 0.45, 1.6);
    }
  }

  // Надпись на спинке остаётся читаемой, куда бы ни повернул жук.
  function uprightText(c, b, text, x, y, font, color) {
    c.save();
    c.translate(x, y);
    c.rotate(-b.angle);
    c.font = font;
    c.fillStyle = color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 0, 0);
    c.restore();
  }

  function dot(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      dot(ctx, p.x, p.y, p.size / 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawRings() {
    ctx.lineWidth = 2;
    for (const r of rings) {
      ctx.globalAlpha = (r.life / r.max) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawWave(w) {
    const k = 1 - w.r / w.max;
    ctx.save();
    ctx.globalAlpha = 0.05 + 0.15 * k;
    ctx.fillStyle = '#7dd3fc';
    dot(ctx, w.x, w.y, w.r);
    ctx.globalAlpha = 0.1 + 0.9 * k;
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 6;
    ctx.shadowColor = '#7dd3fc';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawTexts() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(8,10,18,0.85)';
    for (const t of texts) {
      const age = t.max - t.life;
      const pop = 1 + 0.35 * Math.max(0, 1 - age * 7);
      ctx.globalAlpha = Math.min(1, t.life / 0.3);
      ctx.font = `800 ${Math.round(t.size * pop)}px ${SANS}`;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawScreenFx() {
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,40,60,${flash * 0.22})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (game && (state === 'playing' || state === 'dying') && game.uptime < 35) {
      const pulse = (Math.sin(time * 5) + 1) / 2;
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(255,0,40,0)');
      g.addColorStop(1, `rgba(255,0,40,${0.12 + 0.12 * pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (state === 'dying') {
      const k = 1 - game.dyingT / DYING_TIME;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(clamp(W * 0.1, 40, 96))}px ${SANS}`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(8,10,18,0.9)';
      ctx.strokeText('ПРОД УПАЛ', W / 2, H * 0.45);
      ctx.fillStyle = '#ff4d5e';
      ctx.fillText('ПРОД УПАЛ', W / 2, H * 0.45);
      ctx.restore();
    }
  }

  function drawBanner() {
    const age = banner.max - banner.life;
    const y = H * 0.24 - (1 - Math.min(1, age * 4)) * 20;
    ctx.save();
    ctx.globalAlpha = Math.min(1, age * 4, banner.life * 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(8,10,18,0.85)';
    ctx.font = `900 ${Math.round(clamp(W * 0.08, 34, 64))}px ${SANS}`;
    ctx.lineWidth = 6;
    ctx.strokeText(banner.title, W / 2, y);
    ctx.fillStyle = '#ffb347';
    ctx.fillText(banner.title, W / 2, y);
    ctx.font = `700 ${Math.round(clamp(W * 0.03, 15, 20))}px ${SANS}`;
    ctx.lineWidth = 4;
    ctx.strokeText(banner.sub, W / 2, y + 44);
    ctx.fillStyle = '#e6e9f5';
    ctx.fillText(banner.sub, W / 2, y + 44);
    if (banner.note) {
      ctx.font = `600 13px ${MONO}`;
      ctx.strokeText(banner.note, W / 2, y + 72);
      ctx.fillStyle = '#5ef08f';
      ctx.fillText(banner.note, W / 2, y + 72);
    }
    ctx.restore();
  }

  // Шлёпанец «с тремя полосками». Точка (0, 0) — центр ударной части подошвы.
  function solePath(c) {
    c.beginPath();
    c.moveTo(0, -30);
    c.bezierCurveTo(13, -30, 18, -16, 17, -2);
    c.bezierCurveTo(16, 10, 11, 18, 11, 28);
    c.bezierCurveTo(11, 41, 7, 50, -1, 50);
    c.bezierCurveTo(-9, 50, -13, 41, -13, 28);
    c.bezierCurveTo(-13, 18, -17, 10, -17, -2);
    c.bezierCurveTo(-18, -16, -13, -30, 0, -30);
    c.closePath();
  }

  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawSlipper(x, y) {
    const lift = 1 - slipper.press;
    const rot = -0.5 + slipper.press * 0.3;
    const scale = 0.95 + lift * 0.1;

    ctx.save();
    ctx.translate(x + 10 * lift + 2, y + 12 * lift + 3);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    solePath(ctx);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    solePath(ctx);
    ctx.fillStyle = '#1d2233';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#cfd6e6';
    ctx.stroke();
    ctx.save();
    ctx.scale(0.82, 0.9);
    ctx.translate(0, 2);
    solePath(ctx);
    ctx.fillStyle = '#2a3047';
    ctx.fill();
    ctx.restore();
    roundRectPath(ctx, -20, -16, 40, 17, 7);
    ctx.fillStyle = '#2563eb';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 8 - 3, -13);
      ctx.lineTo(i * 8 + 3, -2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- HUD и меню ----------
  function setText(el, key, value) {
    if (hudCache[key] === value) return;
    hudCache[key] = value;
    el.textContent = value;
  }

  function restartAnimation(el) {
    el.classList.remove('bump');
    void el.offsetWidth; // перезапуск CSS-анимации
    el.classList.add('bump');
  }

  function syncHud(dt) {
    if (!game || ui.hud.hidden) return;
    game.shownScore += (game.score - game.shownScore) * Math.min(1, dt * 12);
    if (Math.abs(game.score - game.shownScore) < 1) game.shownScore = game.score;
    setText(ui.score, 'score', String(Math.round(game.shownScore)));
    setText(ui.sprint, 'sprint', `Спринт ${game.level}`);
    setText(ui.combo, 'combo', game.combo >= 2 ? `комбо ${game.combo} · x${comboMult(game.combo)}` : '');
    setText(ui.uptimeText, 'uptime', `${game.uptime.toFixed(1)}%`);
    if (hudCache.fill !== game.uptime) {
      hudCache.fill = game.uptime;
      ui.uptimeFill.style.width = `${game.uptime}%`;
      ui.uptimeFill.style.backgroundColor = game.uptime > 60 ? 'var(--ok)' : game.uptime > 30 ? 'var(--warn)' : 'var(--bad)';
    }
    setText(ui.charges, 'charges', '●'.repeat(game.charges) + '○'.repeat(MAX_CHARGES - game.charges));
    const canRevert = state === 'playing' && game.charges > 0 && !game.wave;
    if (hudCache.canRevert !== canRevert) {
      hudCache.canRevert = canRevert;
      ui.revertBtn.disabled = !canRevert;
    }
    if (hudBump.score) restartAnimation(ui.score);
    if (hudBump.combo && game.combo >= 2) restartAnimation(ui.combo);
    hudBump.score = false;
    hudBump.combo = false;
  }

  function initLegend() {
    for (const cv of document.querySelectorAll('canvas[data-type]')) {
      const type = cv.dataset.type;
      cv.width = 40 * dpr;
      cv.height = 40 * dpr;
      const bug = makeBug(type, 0, 0, 1);
      bug.angle = -Math.PI / 2;
      bug.grow = 1;
      bug.teleportCd = Infinity;
      legend.push({ c: cv.getContext('2d'), bug, scale: Math.min(1, 12.5 / TYPES[type].size) });
    }
  }

  function drawLegend(dt) {
    if (ui.menu.hidden) return;
    for (const { c, bug, scale } of legend) {
      bug.legPhase += dt * 9;
      bug.wing += dt * 12;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, 40, 40);
      c.translate(20, 20);
      c.scale(scale, scale);
      drawBug(c, bug);
    }
  }

  // ---------- Ввод ----------
  canvas.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (e.pointerType === 'mouse') pointer.visible = true;
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') pointer.visible = false;
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.visible = true;
    // На тач-экране тапок виден только мгновение после касания.
    pointer.hideAt = e.pointerType === 'mouse' ? 0 : performance.now() + 450;
    audio.init();
    if (state === 'playing') swat(e.clientX, e.clientY);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'Space':
        if (state === 'playing') {
          e.preventDefault();
          revert();
        }
        break;
      case 'KeyP':
      case 'Escape':
        if (state === 'playing') pauseGame();
        else if (state === 'paused') resumeGame();
        break;
      case 'KeyM':
        toggleMute();
        break;
      case 'Enter':
        if ((state === 'menu' || state === 'over') && !(document.activeElement instanceof HTMLButtonElement)) startGame();
        break;
      default:
    }
  });

  // HUD-кнопки сразу теряют фокус, иначе пробел «нажмёт» их повторно.
  const hudClick = (handler) => (e) => {
    handler();
    e.currentTarget.blur();
  };
  ui.startBtn.addEventListener('click', startGame);
  ui.restartBtn.addEventListener('click', startGame);
  ui.resumeBtn.addEventListener('click', resumeGame);
  ui.revertBtn.addEventListener('click', hudClick(revert));
  ui.pauseBtn.addEventListener('click', hudClick(pauseGame));
  ui.muteBtn.addEventListener('click', hudClick(toggleMute));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener('blur', pauseGame);
  window.addEventListener('resize', resize);

  // Только чтение: заглянуть в состояние из консоли или автотеста.
  window.fridayDeploy = {
    snapshot: () => ({
      state,
      score: game ? game.score : 0,
      uptime: game ? game.uptime : 100,
      level: game ? game.level : 0,
      combo: game ? game.combo : 0,
      charges: game ? game.charges : 0,
      squashed: game ? game.squashed : 0,
      bugs: bugs.map((b) => ({ type: b.type, x: Math.round(b.x), y: Math.round(b.y), hp: b.hp, small: b.small })),
    }),
  };

  // ---------- Старт ----------
  resize();
  initLegend();
  updateMenuBest();
  syncMuteButton();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    render();
    syncHud(dt);
    drawLegend(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
