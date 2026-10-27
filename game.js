/* =========================================================
   おほしさまキャッチ！  game.js
   天使幼稚園75周年記念 ミニゲーム第2弾
   外部ライブラリなし / 外部通信なし / 音声ファイルなし
   ========================================================= */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     難易度の設定（ここを変えると遊びやすさが変わります）
     --------------------------------------------------------- */
  const CONFIG = {
    GAME_TIME: 45,            // あそぶ時間（秒）
    GOAL: 75,                 // めざすポイント
    NORMAL_POINTS: 1,         // ふつうの星のポイント
    GOLD_POINTS: 5,           // 金色の星のポイント
    SHOOT_POINTS: 3,          // ながれぼしのポイント

    SPAWN_INTERVAL_START: 0.7, // はじめの星の出る間隔（秒）
    SPAWN_INTERVAL_END: 0.42,  // おわりごろの星の出る間隔（秒）
    RAMP_START: 6,             // この秒数から少しずつ星が増える
    RAMP_END: 30,              // この秒数で最大の出現頻度になる

    FALL_TIME_START: 6.5,     // はじめ：星が画面の上から下まで落ちる秒数（大きいほどゆっくり）
    FALL_TIME_END: 5.0,       // おわりごろ：同上
    GOLD_SLOWER: 1.12,        // 金色の星は少しゆっくり（倍率）

    GOLD_CHANCE: 0.14,        // 金色の星の出る確率（ふつう）
    GOLD_CHANCE_HELP: 0.4,    // ペースが遅れているときの最大確率（お助け）
    HELP_DEFICIT: 15,         // 何ポイント遅れたらお助けが最大になるか
    PACE_FINISH: 40,          // 「この秒数で75に届く」ペースを基準にお助け判定

    MAX_STARS: 16,            // 画面に同時に出る星の最大数
    STAR_SIZE: 0.085,         // 星の大きさ（画面の短い辺に対する割合）
    STAR_MIN: 24,             // 星の半径の最小（px）
    STAR_MAX: 46,             // 星の半径の最大（px）
    GOLD_SCALE: 1.25,         // 金色の星の大きさ（倍率）
    HIT_SCALE: 1.7,           // タッチ判定の広さ（見た目に対する倍率）
    MIN_HIT_RADIUS: 40,       // タッチ判定の最小半径（px）

    SHOOT_SPEED: 1.9,         // ながれぼしの速さ（ふつうの星の何倍か）
    SHOOT_HIT: 1.15,          // ながれぼしのタッチ判定（速いので少し広め）
    KUMO_SCALE: 1.25,         // かみなりぐもの大きさ（星に対する倍率）
    KUMO_HIT: 0.95,           // かみなりぐものタッチ判定（見た目より少しせまく＝やさしく）
    KUMO_SLOWER: 1.25,        // かみなりぐもは星よりゆっくり（倍率）
    KUMO_MIN_GAP: 1.6,        // かみなりぐもが続けて出ないための間隔（秒）
    STUN_TIME: 1.5,           // かみなりぐもにさわったとき、星がとれなくなる秒数

    VOLUME: 0.16,             // 音の大きさ（0〜1。大きくしすぎないでください）
  };

  /* ---------------------------------------------------------
     レベルごとの設定
       speed     : 星の落ちる速さ（倍率。大きいほど速い）
       size      : 星の大きさ（倍率）
       spawn     : 星の出る間隔（倍率。小さいほど星が多い）
       kumo      : かみなりぐもの出る確率（0なら出ない）
       shoot     : ながれぼしの出る確率（0なら出ない）
       goldSpeed : 金色の星の速さ（倍率。1より小さいとゆっくり）
       help      : お助け（遅れているときの金色の星の最大確率。0ならなし）
     --------------------------------------------------------- */
  const LEVELS = {
    easy:   { name: 'やさしい',   stars: 1, speed: 1.0, size: 1.0,  spawn: 1.0,  kumo: 0,    shoot: 0,    goldSpeed: 1 / CONFIG.GOLD_SLOWER, help: CONFIG.GOLD_CHANCE_HELP },
    normal: { name: 'ふつう',     stars: 2, speed: 1.3, size: 0.92, spawn: 0.92, kumo: 0.09, shoot: 0.07, goldSpeed: 1.2, help: 0.26 },
    hard:   { name: 'むずかしい', stars: 3, speed: 1.7, size: 0.84, spawn: 0.85, kumo: 0.15, shoot: 0.09, goldSpeed: 1.25, help: 0 },
    // スペシャルステージ：むずかしいを1回クリアすると あらわれる。星のかわりに いんせきが 猛スピードで落ちてくる（速さは むずかしいの1.8倍）
    oni:    { name: 'おにチャレンジ', stars: 4, speed: 3.06, size: 0.84, spawn: 0.62, kumo: 0.12, shoot: 0.1, goldSpeed: 1.1, help: 0 },
  };

  const params = new URLSearchParams(location.search);
  const DEBUG = params.has('debug');
  if (DEBUG && params.get('time')) CONFIG.GAME_TIME = Number(params.get('time')) || CONFIG.GAME_TIME;

  if (params.has('reduced')) document.documentElement.classList.add('reduced');
  const reduceMotionMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(reduceMotionMQ && reduceMotionMQ.matches) || params.has('reduced');

  /* ---------------------------------------------------------
     DOM
     --------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const canvas = $('stage');
  const ctx = canvas.getContext('2d');
  const hud = $('hud');
  const scoreEl = $('score');
  const timeEl = $('time');
  const ringEl = $('time-ring');
  const gaugeEl = $('gauge-fill');
  const soundBtn = $('sound-btn');
  const vibeBtn = $('vibe-btn');
  const screens = {
    title: $('title-screen'),
    clear: $('clear-screen'),
    timeup: $('timeup-screen'),
    level: $('level-screen'),
    intro: $('oni-intro-screen'),
  };
  const RING_LEN = 2 * Math.PI * 16;

  /* ---------------------------------------------------------
     効果音（Web Audio API で合成。初期状態はオフ）
     --------------------------------------------------------- */
  // ぶるぶる（スマホのバイブ）。Androidのブラウザだけ。はじめはオフ、短く弱めに。
  // パソコンやiPhoneでは使えないので、ボタンも出さない（?debug&vibe でテスト用に出せる）
  const Vibe = {
    supported: typeof navigator.vibrate === 'function' &&
      (window.matchMedia('(pointer: coarse)').matches || (DEBUG && params.has('vibe'))),
    enabled: false,
    log: [],
    buzz(pattern) {
      if (!this.enabled) return;
      if (DEBUG) this.log.push(pattern);
      // まだ画面にさわっていないときは、ブラウザがことわるので呼ばない
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      try { navigator.vibrate(pattern); } catch (e) { /* ふるえなくても遊べる */ }
    },
    // ふるえかた（ミリ秒。ふるえる・とまる・ふるえる…）
    catch() { this.buzz(12); },
    gold() { this.buzz([20, 40, 20]); },
    combo() { this.buzz([15, 40, 15]); },
    band() { this.buzz([25, 50, 25, 50, 25]); },
    clear() { this.buzz([40, 70, 40, 70, 90]); },
  };

  // 全体の音の大きさ（CONFIG.VOLUME にかける数。1 で上限そのまま。1より大きくしないでください）
  const MASTER_LEVEL = 1;
  // 星を取ったときの音の大きさ（スマホでもよく聞こえるように大きめ）
  const CATCH_LEVEL = 0.55;

  const Sound = {
    ctx: null,
    master: null,
    enabled: false,

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        // コンプレッサーで音割れ・急な大音量を防ぐ
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 6;
        this.master = this.ctx.createGain();
        this.master.gain.value = CONFIG.VOLUME * MASTER_LEVEL;
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    },

    setEnabled(on) {
      this.enabled = on;
      // オフにした瞬間に、予約済みの音もマスターで消音する。
      if (this.master) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.value = on ? CONFIG.VOLUME * MASTER_LEVEL : 0;
      }
      if (on && this.ensure()) this.chime();
    },

    // 1音を鳴らす（やさしく立ち上がって、すっと消える）
    tone(freq, when, dur, type = 'sine', vol = 1, endFreq = null, dest = null) {
      const c = this.ctx;
      const t = c.currentTime + when;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq,t);
      if(endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq,t+dur*.65);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(dest || this.master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },

    ready() {
      return this.enabled && this.ensure();
    },

    // 本作のために作曲した短いチップチューン。既存曲は参照しない。
    phrase(notes, beat=0.08, wave='sine', gain=0.16) {
      if (!this.ready()) return;
      notes.forEach((f,i)=>this.tone(f,i*beat,beat*0.95,wave,gain));
    },
    // 星を取るたびに「きらきら星」が1音ずつ進む。
    // メロディーは18世紀フランスの古い歌（作者不詳）で、自由に使える。日本語の歌詞は使わない。
    MELODY: [523,523,784,784,880,880,784, 698,698,659,659,587,587,523,
             784,784,698,698,659,659,587, 784,784,698,698,659,659,587,
             523,523,784,784,880,880,784, 698,698,659,659,587,587,523],
    melodyIndex: 0,
    nextNote() {
      const f = this.MELODY[this.melodyIndex % this.MELODY.length];
      this.melodyIndex++;
      return f;
    },
    kiran() {
      const f = this.nextNote();
      if (!this.ready()) return;
      this.tone(f*.86,0,.22,'triangle',CATCH_LEVEL,f);
      this.tone(f * 2, 0, 0.16, 'triangle', CATCH_LEVEL * 0.35);
    },
    gold() {
      const f = this.nextNote();
      if (!this.ready()) return;
      this.tone(f*.9,0,.26,'triangle',CATCH_LEVEL,f);
      this.tone(f*1.26,.02,.22,'triangle',CATCH_LEVEL * 0.45);
      this.tone(f * 2, 0.12, 0.24, 'triangle', CATCH_LEVEL * 0.45);
    },
    shoot() {
      const f = this.nextNote();
      if (!this.ready()) return;
      this.tone(f*.88,0,.22,'triangle',CATCH_LEVEL,f);
      this.tone(f * 1.5, 0.06, 0.2, 'triangle', CATCH_LEVEL * 0.5);
    },
    biri() { this.phrase([220,247,220],0.085,'triangle',0.15); },
    // 虹の だんが そろったとき
    band() {
      if (!this.ready()) return;
      [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.05 + i * 0.07, 0.25, 'triangle', 0.12));
    },
    // れんぞくキャッチの ほめ言葉が出たとき（れんぞくが長いほど高い音）
    combo(tier) {
      if (!this.ready()) return;
      const f = 1568 * Math.pow(1.12, tier);
      this.tone(f, 0.06, 0.16, 'triangle', 0.1);
      this.tone(f * 1.5, 0.13, 0.22, 'triangle', 0.08);
    },
    chime() { this.phrase([698,932],0.08,'sine',0.14); },
    start() { this.phrase([523,698,659,988],0.1,'triangle',0.13); },
    fanfare() {
      if (!this.ready()) return;
      const melody=[[698,0,.14],[880,.18,.14],[784,.36,.24],[1047,.66,.18],
        [988,.9,.16],[1175,1.1,.22],[880,1.4,.14],[1397,1.6,.55]];
      melody.forEach(([f,t,d])=>this.tone(f,t,d,'triangle',0.13));
      [[349,0],[440,.36],[392,.66],[494,1.1],[349,1.6],[523,1.9]].forEach(([f,t])=>this.tone(f,t,.3,'triangle',0.17));
    },
    timeup() { this.phrase([698,587,659,784],0.15,'triangle',0.2); },
  };

  /* ---------------------------------------------------------
     BGM（プレイ中だけ。本作のために作ったオリジナルの伴奏。既存曲は参照しない）
     - 星を取ったときの「きらきら星」と同じハ長調で、うしろで小さく鳴る
     - 音がオフのときは鳴らない。お祝い・時間切れの画面では止まる
     - のこり10秒になると少しだけ速くなる
     --------------------------------------------------------- */
  const BGM_VOLUME = 1.0; // 効果音にくらべた BGM の大きさ（0〜1。効果音より小さく）
  const CHORDS = {
    C:  { bass: [131, 98],  tones: [262, 330, 392] },
    Am: { bass: [110, 82],  tones: [220, 262, 330] },
    F:  { bass: [87, 131],  tones: [220, 262, 349] },
    G:  { bass: [98, 147],  tones: [196, 247, 294] },
    E:  { bass: [82, 123],  tones: [208, 247, 330] },
  };
  const SONGS = {
    // ふつうのステージ：ぽよん、ぽよんと はずむ ゆっくりめの伴奏
    pop: { bpm: 108, drive: false,
      bars: ['C', 'Am', 'F', 'G', 'C', 'Am', 'G', 'C'],
      bells: [null, [659, 784], null, [880, 784], null, [659, 523], null, [784, 1047]] },
    // おにチャレンジ：速くて元気な伴奏（こわくしない）
    oni: { bpm: 132, drive: true,
      bars: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E'],
      bells: [null, [659, 880], null, [784, 988], null, [659, 880], null, [831, 988]] },
  };
  const Bgm = {
    out: null, song: null, key: '', step: 0, next: 0, lastElapsed: 0,
    // 毎コマ呼ぶ。0.3秒先までの音を予約する（画面が止まると自然に音も止まる）
    tick() {
      const want = state === 'play' && Sound.enabled && Sound.ctx && Sound.ctx.state === 'running';
      if (!want) { this.stop(); return; }
      const c = Sound.ctx;
      // レベルが変わったときや、新しい回が始まったときは はじめから
      const key = levelKey === 'oni' ? 'oni' : 'pop';
      if (this.out && (this.key !== key || elapsed < this.lastElapsed)) this.stop();
      this.lastElapsed = elapsed;
      if (!this.out) {
        this.key = key;
        this.out = c.createGain();
        this.out.gain.setValueAtTime(0.0001, c.currentTime);
        this.out.gain.exponentialRampToValueAtTime(BGM_VOLUME, c.currentTime + 0.6);
        this.out.connect(Sound.master);
        this.song = SONGS[key];
        this.step = 0;
        this.next = c.currentTime + 0.1;
      }
      const hurry = elapsed > CONFIG.GAME_TIME - 10 ? 1.12 : 1;
      const eighth = 60 / (this.song.bpm * hurry) / 2;
      while (this.next < c.currentTime + 0.3) {
        this.play(this.step, this.next, eighth);
        this.step++;
        this.next += eighth;
      }
    },
    play(step, t, eighth) {
      const song = this.song, i = step % 8, bar = Math.floor(step / 8) % song.bars.length;
      const ch = CHORDS[song.bars[bar]], when = t - Sound.ctx.currentTime;
      const tone = (f, d, type, vol, end) => Sound.tone(f, when, d, type, vol, end || null, this.out);
      // ベース：ふつうは1拍目と3拍目、おには8分音符で きざむ
      // スマホの小さなスピーカーは低い音が出にくいので、1オクターブ上げて、さらに上の音を少し重ねる
      const bass = (f, d, v) => { tone(f * 2, d, 'triangle', v * 0.7); tone(f * 4, d * 0.8, 'triangle', v * 0.55); };
      if (song.drive) { if (i % 2 === 0) bass(ch.bass[0] * (i % 4 === 0 ? 1 : 2), eighth * 1.6, 0.22); }
      else if (i === 0 || i === 4) bass(ch.bass[i === 0 ? 0 : 1], eighth * 3, 0.3);
      // 和音：2拍目と4拍目に、ぽんっと やわらかく
      if (i === 2 || i === 6) ch.tones.forEach(f => tone(f < 300 ? f * 2 : f, eighth * 1.4, 'triangle', 0.1));
      // ベル：ときどき「ぷるん」とすべり上がる高い音
      const bell = song.bells[bar];
      if (bell && (i === 6 || i === 7)) tone(bell[i - 6], eighth * 1.8, 'triangle', 0.14, bell[i - 6] * 1.02);
    },
    stop() {
      if (!this.out) return;
      const c = Sound.ctx, g = this.out;
      this.out = null;
      try {
        g.gain.cancelScheduledValues(c.currentTime);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.15);
      } catch (e) { /* なにもしない */ }
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* なにもしない */ } }, 600);
    },
  };

  /* ---------------------------------------------------------
     画面サイズ
     --------------------------------------------------------- */
  let W = 0, H = 0, DPR = 1;
  let starR = 30, baseR = 30;
  const sprites = {};
  let bgCanvas = null;
  let cloudSprite = null;

  function resize() {
    const oldW = W, oldH = H;
    W = Math.max(1, app.clientWidth);
    H = Math.max(1, app.clientHeight);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;

    const base = Math.min(W, H * 0.75);
    baseR = clamp(base * CONFIG.STAR_SIZE, CONFIG.STAR_MIN, CONFIG.STAR_MAX);
    buildSprites();
    cloudSprite = makeCloudSprite(Math.min(W, 700) * 0.32);
    bgCanvas = makeBackground();

    if (oldW && oldH) {
      const sx = W / oldW, sy = H / oldH;
      for (const s of stars) { s.baseX *= sx; s.x *= sx; s.vx *= sx; s.y *= sy; s.vy *= sy; }
      for (const c of clouds) { c.x *= sx; c.y *= sy; }
    }
    if (!clouds.length) initClouds();
    if (!twinkles.length) initTwinkles();
    measureSlots();
  }

  function buildSprites() {
    starR = baseR * level.size;
    const oni = levelKey === 'oni';
    sprites.normal = oni ? makeMeteorSprite(starR, 'normal') : makeStarSprite(starR, false);
    sprites.gold = oni ? makeMeteorSprite(starR * CONFIG.GOLD_SCALE, 'gold') : makeStarSprite(starR * CONFIG.GOLD_SCALE, true);
    sprites.shoot = oni ? makeMeteorSprite(starR, 'fire') : makeStarSprite(starR, false, true);
    sprites.kumo = makeKumoSprite(starR * CONFIG.KUMO_SCALE);
    sprites.mini = makeStarSprite(Math.max(10, starR * 0.42), false);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function easeOutBack(t) { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function offscreen(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * DPR);
    c.height = Math.ceil(h * DPR);
    const g = c.getContext('2d');
    g.scale(DPR, DPR);
    return [c, g];
  }

  /* ---------------------------------------------------------
     絵（すべてコードで描画したオリジナル）
     --------------------------------------------------------- */

  // オリジナル配列のピクセル素材。整数倍率で描画する。
  // 本作専用の、外部素材を使わないなめらかなキャンディ描画。

  const popNumberCache=new Map();
  function pop75(p) {
    const key=p+':'+DPR;if(popNumberCache.has(key))return popNumberCache.get(key);
    const w=11*p,h=7*p,pad=Math.ceil(p*.35),[c,g]=offscreen(w+pad*2,h+pad*2);
    g.translate(pad+w/2,pad);g.font='900 '+(h*1.2)+'px "Hiragino Maru Gothic ProN",Meiryo,sans-serif';g.textAlign='center';g.textBaseline='alphabetic';g.lineJoin='round';
    // 端末の字によって数字の高さがちがうので、実際の高さを測って、ふちどりまで わくの中に収める
    const m=g.measureText('75'),asc=m.actualBoundingBoxAscent||h*.86,desc=m.actualBoundingBoxDescent||0;
    const edge=p*.25,sx=(w-edge*2)/m.width,sy=(h-edge*2)/(asc+desc);
    g.translate(0,edge);g.scale(sx,sy);const base=asc,lw=1/Math.min(sx,sy);
    g.strokeStyle='#76618f';g.lineWidth=p*.44*lw;g.strokeText('75',0,base);
    g.strokeStyle='#fff';g.lineWidth=p*.18*lw;g.strokeText('75',0,base);
    const fill=g.createLinearGradient(0,-asc*.05,0,asc+desc);fill.addColorStop(0,'#fff6b8');fill.addColorStop(.45,'#ffdb8a');fill.addColorStop(1,'#ffadc9');g.fillStyle=fill;g.fillText('75',0,base);
    const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data,cells=[];
    for(let y=0;y<7;y++)for(let x=0;x<11;x++){const px=Math.floor((pad+(x+.5)*p)*DPR),py=Math.floor((pad+(y+.5)*p)*DPR);if(data[(py*c.width+px)*4+3]>80)cells.push([x,y]);}
    const value={c,w,h,pad,cells};popNumberCache.set(key,value);return value;
  }
  function drawPop75(g,x,y,p){const sp=pop75(p);g.drawImage(sp.c,x-sp.w/2-sp.pad,y-sp.pad,sp.w+sp.pad*2,sp.h+sp.pad*2);}
  function popLabel(g,text,x,y,fs=15) {
    g.save();g.font='800 '+fs+'px Meiryo,sans-serif';const w=g.measureText(text).width+20,h=fs+14;
    roundRectPath(g,x,y,w,h,h/2);g.fillStyle='#fffffff2';g.fill();g.strokeStyle='#d3c0e7';g.lineWidth=2;g.stroke();g.fillStyle='#6b587f';g.textAlign='left';g.textBaseline='middle';g.fillText(text,x+10,y+h/2);g.restore();
  }

  const popCache = new Map();
  function popSprite(key,R,paint) {
    const cacheKey=key+':'+R.toFixed(2)+':'+DPR;
    if(popCache.has(cacheKey)) return popCache.get(cacheKey);
    const size=Math.ceil(R*3),[c,g]=offscreen(size,size);
    g.imageSmoothingEnabled=true;
    paint(g,size/2,size/2,R);
    const sprite={canvas:c,size,R};
    popCache.set(cacheKey,sprite);
    return sprite;
  }
  function popOval(g,x,y,rx,ry,fill) {
    g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=fill;g.fill();
  }
  function popFill(g,x,y,r,top,bottom,edge='#49446b') {
    const grad=g.createLinearGradient(x,y-r,x,y+r);
    grad.addColorStop(0,top);grad.addColorStop(.55,bottom);grad.addColorStop(1,bottom);
    g.fillStyle=grad;g.strokeStyle=edge;g.lineWidth=Math.max(2,r*.095);g.lineJoin='round';g.fill();g.stroke();
  }
  function popStarPath(g,x,y,r) {
    const points=[];
    for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.61:r;points.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}
    const last=points.at(-1),first=points[0];g.beginPath();g.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
    points.forEach((p,i)=>{const next=points[(i+1)%points.length];g.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);});g.closePath();
  }
  function popFace(g,x,y,r,angry=false) {
    const ink='#49446b';
    popOval(g,x-r*.23,y-r*.02,r*.075,r*.11,ink);popOval(g,x+r*.23,y-r*.02,r*.075,r*.11,ink);
    popOval(g,x-r*.245,y-r*.065,r*.025,r*.035,'#fff');popOval(g,x+r*.215,y-r*.065,r*.025,r*.035,'#fff');
    popOval(g,x-r*.39,y+r*.14,r*.12,r*.065,'#ff8daf');popOval(g,x+r*.39,y+r*.14,r*.12,r*.065,'#ff8daf');
    g.strokeStyle=ink;g.lineWidth=Math.max(1.6,r*.055);g.lineCap='round';g.beginPath();
    if(angry){
      g.moveTo(x-r*.37,y-r*.29);g.lineTo(x-r*.12,y-r*.17);g.moveTo(x+r*.37,y-r*.29);g.lineTo(x+r*.12,y-r*.17);
      g.moveTo(x-r*.16,y+r*.31);g.quadraticCurveTo(x,y+r*.13,x+r*.16,y+r*.31);
    }else{g.moveTo(x-r*.16,y+r*.22);g.quadraticCurveTo(x,y+r*.49,x+r*.16,y+r*.22);}
    g.stroke();
  }
  function popShine(g,x,y,r) {
    g.save();g.translate(x-r*.25,y-r*.42);g.rotate(-.45);popOval(g,0,0,r*.23,r*.1,'rgba(255,255,255,.85)');g.restore();
    popOval(g,x+r*.38,y-r*.26,r*.055,r*.055,'rgba(255,255,255,.7)');
  }
  function popStar(g,x,y,r,gold,pink) {
    g.save();g.shadowColor=gold?'rgba(224,144,38,.24)':'rgba(98,78,133,.15)';g.shadowBlur=r*.1;g.shadowOffsetY=r*.12;
    popStarPath(g,x,y,r*1.22);popFill(g,x,y,r,pink?'#ffe0f0':gold?'#fff4a4':'#fff8ba',pink?'#f897c8':gold?'#ffbb45':'#ffdf65');g.restore();
    popShine(g,x,y,r);popFace(g,x,y,r);
  }
  function popCloud(g,x,y,r,hazard=false) {
    g.save();g.translate(x,y);g.scale(1,.85);g.beginPath();
    g.moveTo(-r*.8,r*.35);g.bezierCurveTo(-r*1.55,r*.25,-r*1.35,-r*.6,-r*.65,-r*.43);
    g.bezierCurveTo(-r*.62,-r*1.2,r*.5,-r*1.2,r*.64,-r*.5);g.bezierCurveTo(r*1.42,-r*.62,r*1.55,r*.4,r*.8,r*.43);
    g.bezierCurveTo(r*.3,r*.65,-r*.35,r*.65,-r*.8,r*.35);g.closePath();
    popFill(g,0,0,r,hazard?'#e3dfef':'#ffffff',hazard?'#9e9bb8':'#e4f4ff',hazard?'#66627f':'#c3dce8');
    if(hazard){popShine(g,0,0,r*.8);popFace(g,0,r*.04,r*.75,true);}g.restore();
  }
  function popMeteor(g,x,y,r,type) {
    const colors={normal:['#f8c9a6','#c88d73'],gold:['#fff3b1','#ffba48'],fire:['#ffd4bf','#fb8c88']}[type];
    g.beginPath();for(let i=0;i<8;i++){const a=-Math.PI/2+i*Math.PI/4,rr=r*(i%2?.97:1.07),px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;if(!i)g.moveTo(px,py);else{const prev=-Math.PI/2+(i-.5)*Math.PI/4;g.quadraticCurveTo(x+Math.cos(prev)*r*1.12,y+Math.sin(prev)*r*1.12,px,py);}}
    g.closePath();popFill(g,x,y,r,colors[0],colors[1]);
    popOval(g,x-r*.58,y+r*.34,r*.17,r*.11,'rgba(113,69,81,.15)');popOval(g,x+r*.5,y+r*.52,r*.12,r*.08,'rgba(113,69,81,.15)');
    popShine(g,x,y,r);popFace(g,x,y+r*.02,r*.88,true);
  }
  function popAngel(g,x,y,r) {
    // 小さな丸い目・羽・ピンクの服を持つ、このゲーム独自の天使。
    g.save();g.lineWidth=Math.max(2,r*.055);g.strokeStyle='#65527b';
    for(const d of [-1,1]){
      g.save();g.translate(x+d*r*.63,y+r*.05);g.rotate(d*.4);g.beginPath();g.ellipse(0,0,r*.49,r*.27,0,0,Math.PI*2);popFill(g,0,0,r*.5,'#fff','#dcf1ff','#b7cbdc');g.restore();
    }
    g.beginPath();g.moveTo(x-r*.38,y+r*.07);g.bezierCurveTo(x-r*.66,y+r*.7,x-r*.38,y+r*.84,x,y+r*.84);g.bezierCurveTo(x+r*.5,y+r*.84,x+r*.64,y+r*.6,x+r*.37,y+r*.07);g.closePath();popFill(g,x,y+r*.4,r*.55,'#ffd7ec','#fa9ecb');
    popOval(g,x-r*.22,y+r*.88,r*.12,r*.12,'#ffdabd');popOval(g,x+r*.22,y+r*.88,r*.12,r*.12,'#ffdabd');
    popOval(g,x-r*.48,y+r*.25,r*.115,r*.14,'#ffdabd');popOval(g,x+r*.48,y+r*.2,r*.115,r*.14,'#ffdabd');
    g.beginPath();g.ellipse(x,y-r*.34,r*.49,r*.5,0,0,Math.PI*2);popFill(g,x,y-r*.34,r*.5,'#fff1df','#ffdabd');
    g.beginPath();g.moveTo(x-r*.5,y-r*.3);g.bezierCurveTo(x-r*.63,y-r*.94,x+r*.52,y-r*1.05,x+r*.5,y-r*.27);g.quadraticCurveTo(x+r*.3,y-r*.65,x+r*.1,y-r*.53);g.quadraticCurveTo(x-r*.1,y-r*.77,x-r*.5,y-r*.3);g.closePath();popFill(g,x,y-r*.6,r*.35,'#bd876f','#91676b');
    popFace(g,x,y-r*.29,r*.48);
    g.strokeStyle='#e9aa36';g.lineWidth=r*.075;g.beginPath();g.ellipse(x,y-r*1.05,r*.32,r*.09,0,0,Math.PI*2);g.stroke();g.strokeStyle='#fff0a4';g.lineWidth=r*.025;g.stroke();
    popStarPath(g,x,y+r*.44,r*.14);g.fillStyle='#fff7a9';g.fill();g.restore();
  }
  function popOni(g,x,y,r) {
    // 二本の小さな角と丸い体、にっこり顔。既存のマスコットは参照しない。
    g.save();
    for(const d of [-1,1]){
      g.beginPath();g.moveTo(x+d*r*.53,y-r*.5);g.quadraticCurveTo(x+d*r*.64,y-r*1.55,x+d*r*.35,y-r*1.2);g.lineTo(x+d*r*.22,y-r*.55);g.closePath();popFill(g,x,y-r*.8,r*.3,'#fff8cc','#ffdb8a');
      popOval(g,x+d*r*.76,y+r*.3,r*.19,r*.2,'#f58f99');popOval(g,x+d*r*.35,y+r*.92,r*.19,r*.15,'#f58f99');
    }
    g.beginPath();g.ellipse(x,y+r*.25,r*.65,r*.64,0,0,Math.PI*2);popFill(g,x,y+r*.3,r*.65,'#ffb8bc','#f07f91');
    g.beginPath();g.ellipse(x,y-r*.22,r*.77,r*.64,0,0,Math.PI*2);popFill(g,x,y-r*.2,r*.75,'#ffc1bd','#f58f99');
    for(let i=0;i<5;i++)popOval(g,x+(i-2)*r*.25,y-r*.72,r*.2,r*.15,'#665675');
    popFace(g,x,y-r*.16,r*.7);popShine(g,x,y-r*.08,r*.7);
    g.beginPath();g.roundRect(x-r*.6,y+r*.57,r*1.2,r*.32,r*.1);popFill(g,x,y+r*.65,r*.3,'#fff4ac','#ffd16b');
    g.strokeStyle='#a77856';g.lineWidth=r*.055;for(const d of [-1,1]){g.beginPath();g.moveTo(x+d*r*.2,y+r*.6);g.lineTo(x+d*r*.3,y+r*.81);g.stroke();}g.restore();
  }

  const pixelCache = new Map();
  function pixelSprite(rows, palette, scale) {
    const key=rows.join('|')+JSON.stringify(palette)+scale;
    if(pixelCache.has(key)) return pixelCache.get(key);
    const c = document.createElement('canvas');
    c.width = rows[0].length * scale; c.height = rows.length * scale;
    const g = c.getContext('2d');
    rows.forEach((row,y)=>[...row].forEach((p,x)=>{if(palette[p]){g.fillStyle=palette[p];g.fillRect(x*scale,y*scale,scale,scale);}}));
    pixelCache.set(key,c);
    return c;
  }
  const PIXEL_STAR = [
    ".......oo.......",
    "......oyyo......",
    "......oyyo......",
    ".....oyyyyo.....",
    ".oooooyyyyooooo.",
    "oyyyyyyyyyyyyyyo",
    ".oyywwyyyyyyyyo.",
    "..oyywkyywkyyo..",
    "...oykkyykkyo...",
    "...opyyyyyypo...",
    "...oyykyykyyo...",
    "..oyyyykkyyyyo..",
    "..oyyyyyyyyyyo..",
    ".oyyyoooooyyyyo.",
    ".oyoo.....ooyyo.",
    "..o.........oo.."
];
  function drawPixel(g,c,x,y,w,h) {
    g.imageSmoothingEnabled=true;g.drawImage(c,x,y,w,h);
  }


  const CLEAR_MESSAGE = 'おほしさまを 75こ あつめた！\nてんしようちえん\n75しゅうねん おめでとう！';
  const ONI_CLEAR_MESSAGE = 'おにチャレンジ クリア！\nいんせきを 75こ あつめた！\nきみは ほしの ゆうしゃだ！';
  function clearMessage() { return levelKey === 'oni' ? ONI_CLEAR_MESSAGE : CLEAR_MESSAGE; }
  const DIGITS = {
    '1':['00100','01100','00100','00100','00100','00100','01110'],
    '3':['11110','00001','00001','01110','00001','00001','11110'],
    '5':['11111','10000','10000','11110','00001','00001','11110'],
    '7':['11111','00001','00010','00010','00100','00100','01000'],
    '+':['00000','00100','00100','11111','00100','00100','00000']
  };
  function pixelText(g,text,x,y,p,color) {
    const width=(text.length*6-1)*p;
    g.fillStyle=color;
    [...text].forEach((ch,i)=>(DIGITS[ch]||[]).forEach((row,yy)=>[...row].forEach((v,xx)=>{if(v==='1')g.fillRect(Math.round(x-width/2+(i*6+xx)*p),Math.round(y+yy*p),p,p);}))); 
  }
  function outlinedPixelText(g,text,x,y,p,color) {
    if(text==='75'){drawPop75(g,x,y,p);return;}
    g.save();g.font='900 '+(p*7)+'px "Hiragino Maru Gothic ProN",Meiryo,sans-serif';g.textAlign='center';g.textBaseline='top';g.lineJoin='round';
    g.strokeStyle='#69547d';g.lineWidth=Math.max(3,p*.9);g.strokeText(text,x,y);g.fillStyle=color;g.fillText(text,x,y);g.restore();
  }
  function chest(g,x,y,scale,open) {
    const w=18*scale,h=10*scale,opening=clamp(open,0,1);g.save();
    if(opening>.15){g.globalAlpha=.55*opening;const glow=g.createRadialGradient(x,y-h*.5,1,x,y-h*.5,h*1.5);glow.addColorStop(0,'#fff5a6');glow.addColorStop(1,'#fff5a600');g.fillStyle=glow;g.fillRect(x-w,y-h*2,w*2,h*2.2);g.globalAlpha=1;}
    const lidY=y-h*.45-opening*h*.75;
    roundRectPath(g,x-w/2,lidY,w,h*.58,h*.22);popFill(g,x,lidY,h*.5,'#ffe0a4','#d79b72','#7b617e');
    roundRectPath(g,x-w/2,y-h*.32,w,h*.9,h*.23);popFill(g,x,y,h*.7,'#f7bc9e','#d58f93','#7b617e');
    if(opening>.3){popOval(g,x,y-h*.28,w*.43,h*.18,'#72556e');popOval(g,x,y-h*.29,w*.33,h*.1,'#ffe9a8');}
    g.strokeStyle='#ffdc8c';g.lineWidth=scale*1.5;g.beginPath();g.moveTo(x-w*.25,y-h*.2);g.lineTo(x-w*.25,y+h*.47);g.moveTo(x+w*.25,y-h*.2);g.lineTo(x+w*.25,y+h*.47);g.stroke();
    roundRectPath(g,x-scale*1.5,y,scale*3,scale*3,scale);g.fillStyle='#ffe5a1';g.fill();popOval(g,x,y+scale*1.5,scale*.45,scale*.55,'#a47b77');g.restore();
  }

  function starPath(g, x, y, outer, inner, points = 5, rot = -Math.PI / 2) {
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = rot + (i * Math.PI) / points;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }

  // かわいい顔つきの星
  function makeStarSprite(R,gold,pink) {
    return popSprite('star:'+gold+':'+pink,R,(g,x,y,r)=>popStar(g,x,y,r,gold,pink));
  }

  function makeCloudSprite(w) {
    const r=w/3;const s=popSprite('cloud-soft',r,(g,x,y,r)=>popCloud(g,x,y,r*.9));
    return {canvas:s.canvas,w:s.size,h:s.size};
  }

  // おにチャレンジの いんせき（ぷんぷん おこった顔の岩。まゆが さがって への字口。こわすぎない）
  const METEOR_ROWS = ['....oooooo....', '..oorrrrrroo..', '.orrrhhrrrrro.', '.orbbrrrrbbro.', 'orrrbbrrbbrrro', 'orrrwerrewrrro', 'orrrwerrewrrro',
    'orrrrrrrrrrrro', 'orrrrmmmmrrrro', 'orkkmrrrrmrrro', '.orkkrrrrrrro.', '.orrrrrrkkrro.', '..oorrrrrroo..', '....oooooo....'];
  const METEOR_COLORS = {
    normal: { r: '#c98a5a', h: '#f0c08a', k: '#94604d' },  // ちゃいろ
    gold:   { r: '#f4b64d', h: '#fff5d5', k: '#c97a00' },  // きんいろ（+5）
    fire:   { r: '#e9786f', h: '#ffe18a', k: '#b9504a' },  // あかい（+3。ななめに とぶ）
  };
  function meteorPalette(type) {
    return Object.assign({ o: '#273455', e: '#273455', m: '#273455', b: '#273455', w: '#fff5d5' }, METEOR_COLORS[type]);
  }
  function makeMeteorSprite(R,type) {
    return popSprite('meteor:'+type,R,(g,x,y,r)=>popMeteor(g,x,y,r,type));
  }
  // 赤おに（にこにこ。いんせきを なげてくる）
  const ONI_ROWS = ['...h......h...', '..hh......hh..', '..hbbbbbbbbh..', '.bbbbbbbbbbbb.', '.brrrrrrrrrrb.', '.rrkkrrrrkkrr.', '.rrkkrrrrkkrr.',
    '.rpprrrrrrppr.', '..rrrmmmmrrr..', '..rrrrrrrrrr..', 'rr.tttttttt.rr', 'rr.tktktktk.rr', '...tttttttt...', '...rr....rr...'];
  const ONI_PALETTE = { h: '#fff5d5', b: '#4a3a5a', r: '#e9786f', k: '#273455', p: '#f6a9ca', m: '#273455', t: '#ffe18a' };

  // かみなりぐも（ちょっとおこった顔。こわくない）
  function makeKumoSprite(R) {
    return popSprite('cloud-hazard',R,(g,x,y,r)=>popCloud(g,x,y,r*.8,true));
  }

  // いなずま
  function drawBolt(g,x,y,s,alpha) {
    g.save();g.globalAlpha=alpha;g.lineJoin='round';g.lineWidth=Math.max(1.5,s*.045);g.strokeStyle='#dfb46c';g.fillStyle='#ffe49b';g.beginPath();g.moveTo(x+s*.12,y);g.lineTo(x-s*.2,y+s*.5);g.lineTo(x+s*.03,y+s*.48);g.lineTo(x-s*.1,y+s*.95);g.lineTo(x+s*.36,y+s*.35);g.lineTo(x+s*.12,y+s*.38);g.closePath();g.fill();g.stroke();g.restore();
  }

  function roundRectPath(g, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function makeBackground() {
    const [c,g]=offscreen(W,H),sky=g.createLinearGradient(0,0,W*.45,H);
    sky.addColorStop(0,'#dff8ff');sky.addColorStop(.55,'#edf2ff');sky.addColorStop(1,'#f8edfa');g.fillStyle=sky;g.fillRect(0,0,W,H);
    // 控えめな水玉。乱数を消費しないのでゲームの出現に影響しない。
    g.fillStyle='rgba(255,255,255,.48)';
    for(let row=0;row<H/44;row++)for(let col=0;col<W/44;col++){g.beginPath();g.arc(col*44+(row%2)*22,row*44,3,0,Math.PI*2);g.fill();}
    g.fillStyle='#e0f3e5';g.beginPath();g.moveTo(0,H);g.lineTo(0,H-26);g.bezierCurveTo(W*.25,H-70,W*.55,H+8,W,H-38);g.lineTo(W,H);g.fill();return c;
  }

  const RAINBOW = ['#e98694', '#f5d2b1', '#ffe18a', '#7fad98', '#91cde5', '#669dbc', '#9986b8'];
  function drawRainbow(g,cx,cy,R,thick,progress,alpha) {
    const colors=['#ff9cbb','#ffc28c','#ffe794','#9edcb9','#9dcff6','#c2adf1'];g.save();g.globalAlpha=alpha;g.lineCap='round';
    colors.forEach((color,i)=>{g.beginPath();g.strokeStyle=color;g.lineWidth=Math.max(5,thick*.9);g.arc(cx,cy,R-thick*i,Math.PI,Math.PI+Math.PI*clamp(progress,0,1));g.stroke();});g.restore();
  }

  function drawCloudPile(g,x,y,w) {
    const s=cloudSprite;g.save();g.globalAlpha*=.55;g.imageSmoothingEnabled=true;g.drawImage(s.canvas,x-w/2,y-w/2,w,w);g.restore();
  }

  // 天使（オリジナル）
  function drawAngel(g,x,y,s,t,wave) {
    const r=s*.43,sp=popSprite('angel',r,popAngel);g.save();
    const wobble=!reduced()&&wave?Math.sin(t*2.8)*.025:0;g.translate(x,y);g.rotate(wobble);g.imageSmoothingEnabled=true;g.drawImage(sp.canvas,-sp.size/2,-sp.size/2,sp.size,sp.size);g.restore();
  }

  // 4つの光のキラキラ
  function sparkle(g,x,y,r,color,alpha) {
    g.save();g.globalAlpha=alpha;popOval(g,x,y,r*.6,r*.6,color);popOval(g,x-r*.13,y-r*.18,r*.16,r*.12,'rgba(255,255,255,.9)');g.restore();
  }

  /* ---------------------------------------------------------
     背景の動くもの
     --------------------------------------------------------- */
  const clouds = [];
  const twinkles = [];
  function initClouds() {
    clouds.length = 0;
    const n = W > 700 ? 5 : 4;
    for (let i = 0; i < n; i++) {
      clouds.push({
        x: rand(0, W),
        y: rand(H * 0.12, H * 0.85),
        w: rand(0.6, 1.1) * cloudSprite.w,
        v: rand(4, 10) * (Math.random() < 0.5 ? 1 : -1),
        a: rand(0.55, 0.9),
      });
    }
  }
  function initTwinkles() {
    twinkles.length = 0;
    for (let i = 0; i < 26; i++) {
      twinkles.push({ x: Math.random(), y: Math.random() * 0.85, r: rand(2, 4.5), p: rand(0, 6.28), sp: rand(0.8, 1.6) });
    }
  }

  // 画面の「天使の場所」をHTMLから測る
  const slots = {};
  // ぶるぶるボタンの場所：おとボタンの左どなり → だめなら左上。画面の文字やボタンに重ならないほうにする
  function placeVibeBtn(appRect) {
    if (vibeBtn.hidden) return;
    const scr = Object.values(screens).find(el => !el.hidden);
    const items = scr ? [...scr.querySelectorAll('*')].filter(el => !el.children.length && !el.closest('.angel-slot, .celebration-art'))
      .map(el => el.getBoundingClientRect()).filter(r => r.width && r.height) : [];
    const sr = soundBtn.getBoundingClientRect();
    const spots = [
      { right: Math.round(appRect.right - sr.left + 12) + 'px', left: 'auto' },
      { right: 'auto', left: 'calc(14px + var(--safe-l, 0px))' },
    ];
    for (const sp of spots) {
      vibeBtn.style.right = sp.right; vibeBtn.style.left = sp.left;
      const r = vibeBtn.getBoundingClientRect();
      if (!items.some(c => r.left - 4 < c.right && r.right + 4 > c.left && r.top - 4 < c.bottom && r.bottom + 4 > c.top)) return;
    }
    vibeBtn.style.right = spots[0].right; vibeBtn.style.left = spots[0].left;
  }

  function measureSlots() {
    const appRect = app.getBoundingClientRect();
    placeVibeBtn(appRect);
    document.querySelectorAll('.angel-slot').forEach((el) => {
      const r = el.getBoundingClientRect();
      // かくれている場所（よこ画面で天使をださない時など）は使わない
      if (r.width === 0 && r.height === 0) { delete slots[el.dataset.angel]; return; }
      slots[el.dataset.angel] = {
        x: r.left - appRect.left + r.width / 2,
        y: r.top - appRect.top + r.height / 2,
        s: Math.min(r.height * 0.95, r.width * 0.9),
      };
    });
    const b = document.querySelector('.big75').getBoundingClientRect();
    if (b.height) slots.big75 = { x: b.left - appRect.left + b.width / 2, bottom: b.bottom - appRect.top };
  }

  /* ---------------------------------------------------------
     ゲームの状態
     --------------------------------------------------------- */
  let state = 'title';     // title / play / clear / timeup
  let score = 0;
  let elapsed = 0;
  let spawnTimer = 0;
  let sceneT = 0;          // いまの画面になってからの秒数
  let clock = 0;           // 全体の時間（アニメ用）
  let lastShownTime = -1;
  let stunUntil = 0;       // この時間まで しびれて星がとれない
  let lastKumoAt = -99;
  let levelKey = 'easy';
  let level = LEVELS.easy;
  // 第1弾の演出（点数・時間・星の出かたには関わらない）
  const caughtLog = [];    // 取った星の場所（お祝いで「75」を作る）
  let rainbowShown = 0;    // プレイ中の虹（0〜1。点数をなめらかに追いかける）
  const cheer = { said: {}, text: '', until: 0, prio: 0, hopUntil: 0, wasStunned: false, countdown: false };
  let flyers = [];         // お祝いで「75」へ飛んでいく星
  // 第2弾：園庭の花（遊ぶたびに1輪ずつ咲く。記録はこの端末の中だけ）
  let gardenCount = 0;
  let gardenBloomAt = 0;
  // 第3弾：虹のだん・れんぞくキャッチ
  let bandsDone = 0;       // そろった虹のだんの数（0〜6）
  const combo = { count: 0, last: -9 };   // いまの画面で、新しい花が咲きはじめる時間（sceneT）
  const stars = [];
  const particles = [];
  const decoStars = [];
  const recentX = [];
  let nextId = 1;
  // おにチャレンジ：'1'＝あらわれた（まだ遊んでいない）、'2'＝遊んだことがある。記録はこの端末の中だけ
  let oniState = '';
  let oniJustOpened = false;
  let oniThrowId = 0, oniThrowUntil = 0;
  const timers = [];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearLater() { while (timers.length) clearTimeout(timers.pop()); }

  function showScreen(name) {
    for (const [k, el] of Object.entries(screens)) {
      el.hidden = k !== name;
      el.classList.remove('go', 'show-btn');
      el.querySelectorAll('.retry').forEach(b => { b.disabled = true; });
    }
    hud.hidden = name !== 'play';
    app.classList.toggle('playing', name === 'play');
    if (screens[name]) {
      // レイアウト確定後に天使の位置を測る
      measureSlots();
      void screens[name].offsetWidth;
      screens[name].classList.add('go');
    }
  }

  function startGame() {
    clearLater();
    Sound.start();
    state = 'play';
    score = 0;
    elapsed = 0;
    spawnTimer = 0.35;
    stunUntil = 0;
    lastKumoAt = -99;
    sceneT = 0;
    lastShownTime = -1;
    stars.length = 0;
    particles.length = 0;
    recentX.length = 0;
    Sound.melodyIndex = 0;
    caughtLog.length = 0;
    rainbowShown = 0;
    cheer.said = {}; cheer.text = ''; cheer.until = 0; cheer.prio = 0; cheer.hopUntil = 0; cheer.wasStunned = false; cheer.countdown = false;
    flyers = [];
    bandsDone = 0;
    combo.count = 0; combo.last = -9;
    if (levelKey === 'oni' && oniState === '1') saveOni('2');
    const cap = document.querySelector('.hud-caption');
    cap.textContent = levelKey === 'oni' ? 'いんせき' : 'ほし';
    cap.classList.toggle('long', levelKey === 'oni'); // 4文字なので少し小さく（時間・おとボタンと重ならないように）
    oniThrowId = nextId; oniThrowUntil = 0;
    showScreen('play');
    welcomeStars();
    updateHud(false);
    canvas.focus({ preventScroll: true });
  }

  function finishClear() {
    state = 'clear';
    sceneT = 0;
    // 残っている星はキラキラに変わる（ポイントなし）
    for (const s of stars) {
      if (s.kind === 'kumo') puff(s.x, s.y);
      else burst(s.x, s.y, s.gold, false);
    }
    stars.length = 0;
    Sound.fanfare();
    Vibe.clear();
    showScreen('clear');
    buildFlyers();
    addFlower(reduced() ? 0.3 : 2.4);
    $('clear-typed').textContent = '';
    $('clear-typed').setAttribute('aria-label', clearMessage());
    // むずかしいを はじめてクリア → おにチャレンジが あらわれる
    oniJustOpened = levelKey === 'hard' && !oniState;
    if (oniJustOpened) saveOni('1');
    const badge = screens.clear.querySelector('.level-badge');
    badge.innerHTML = oniJustOpened ? 'スペシャルステージ<br>「おにチャレンジ」が あらわれた！' : badgeHTML();
    badge.classList.toggle('oni-new', oniJustOpened);
    // せまい画面ではバッジが出ないので、ボタンでも知らせる（押すと そのまま おにチャレンジへ）
    const toOni = screens.clear.querySelector('.change-level');
    toOni.textContent = oniJustOpened ? 'おにチャレンジへ！' : 'レベルを かえる';
    toOni.classList.toggle('to-oni', oniJustOpened);
    later(() => {
      screens.clear.classList.add('show-btn');
      screens.clear.querySelectorAll('.retry').forEach(b => { b.disabled = false; });
      $('retry-clear').focus({ preventScroll: true });
    }, 3000);
  }

  function finishTimeup() {
    state = 'timeup';
    sceneT = 0;
    $('final-score').textContent = String(score);
    const noun = levelKey === 'oni' ? 'いんせき' : 'おほしさま';
    $('timeup-noun').textContent = noun;
    // あと少しだったときだけ、のこりの数を そっと知らせる（「ざんねん」などは言わない）
    const left = CONFIG.GOAL - score;
    screens.timeup.querySelector('.timeup-msg').innerHTML = left > 0 && left <= NEAR_MISS
      ? 'あと ' + left + 'こ だったね！<br>もういちど チャレンジ！'
      : noun + '<br>いっぱい あつめたね！';
    Sound.timeup();
    showScreen('timeup');
    addFlower(reduced() ? 0.2 : 0.9);
    later(() => {
      screens.timeup.classList.add('show-btn');
      screens.timeup.querySelectorAll('.retry').forEach(b => { b.disabled = false; });
      $('retry-timeup').focus({ preventScroll: true });
    }, 1300);
  }

  /* ---------------------------------------------------------
     星の出現
     --------------------------------------------------------- */
  function progress() {
    return clamp((elapsed - CONFIG.RAMP_START) / (CONFIG.RAMP_END - CONFIG.RAMP_START), 0, 1);
  }

  function goldChance() {
    // 遅れているときは金色の星を少し増やす（お助け）
    const pace = CONFIG.GOAL * Math.min(1, elapsed / CONFIG.PACE_FINISH);
    const deficit = pace - score;
    const help = clamp(deficit / CONFIG.HELP_DEFICIT, 0, 1);
    return lerp(CONFIG.GOLD_CHANCE, Math.max(CONFIG.GOLD_CHANCE, level.help), help);
  }

  function pickKind() {
    const r = Math.random();
    if (level.kumo && elapsed > 4 && elapsed - lastKumoAt >= CONFIG.KUMO_MIN_GAP && r < level.kumo) return 'kumo';
    if (level.shoot && elapsed > 5 && r >= level.kumo && r < level.kumo + level.shoot) return 'shoot';
    // 序盤は金色の星を出さない（最初はふつうの星で慣れる）
    if (elapsed > 3 && Math.random() < goldChance()) return 'gold';
    return 'normal';
  }

  function spawnStar() {
    if (stars.length >= CONFIG.MAX_STARS) return;
    const kind = pickKind();
    if (kind === 'kumo') lastKumoAt = elapsed;
    const r = kind === 'gold' ? starR * CONFIG.GOLD_SCALE : kind === 'kumo' ? starR * CONFIG.KUMO_SCALE : starR;
    let sway = 0;
    if (!reduced() && kind !== 'shoot') sway = kind === 'kumo' ? rand(r * 0.5, r * 0.9) : rand(r * 0.15, r * 0.5);
    const margin = r * 1.25 + sway + 10;
    const minX = margin, maxX = Math.max(margin, W - margin);
    let x = rand(minX, maxX);
    for (let tries = 0; tries < 6; tries++) {
      if (recentX.every((px) => Math.abs(px - x) > r * 2.4)) break;
      x = rand(minX, maxX);
    }

    // 星の種類によって落ちる速さを変える
    let fall = lerp(CONFIG.FALL_TIME_START, CONFIG.FALL_TIME_END, progress()) / level.speed;
    if (kind === 'gold') fall /= level.goldSpeed;
    if (kind === 'shoot') fall /= CONFIG.SHOOT_SPEED;
    if (kind === 'kumo') fall *= CONFIG.KUMO_SLOWER;

    let vx = 0;
    if (kind === 'shoot') {
      // ながれぼし：画面のかたがわから反対がわへ、ななめに流れる
      const dir = Math.random() < 0.5 ? 1 : -1;
      const span = maxX - minX;
      x = dir > 0 ? rand(minX, minX + span * 0.35) : rand(maxX - span * 0.35, maxX);
      vx = (dir * W * 0.38) / fall;
    }
    recentX.push(x);
    if (recentX.length > 2) recentX.shift();

    let hit = Math.max(r * CONFIG.HIT_SCALE, CONFIG.MIN_HIT_RADIUS);
    if (kind === 'shoot') hit *= CONFIG.SHOOT_HIT;
    if (kind === 'kumo') hit = r * CONFIG.KUMO_HIT;

    stars.push({
      id: nextId++,
      kind,
      gold: kind === 'gold',
      r,
      hit,
      baseX: x,
      x,
      y: -r * 1.2,
      vx,
      vy: (H + r * 2.4) / fall * rand(0.92, 1.08),
      sway,
      swayF: kind === 'kumo' ? rand(0.6, 0.9) : rand(0.9, 1.5),
      phase: rand(0, Math.PI * 2),
      rot: 0,
      caught: false,
    });
  }

  /* ---------------------------------------------------------
     タッチ・クリック
     --------------------------------------------------------- */
  function isStunned() {
    return state === 'play' && elapsed < stunUntil;
  }

  function catchStar(s) {
    if (s.caught || state !== 'play') return false; // 二重得点の防止
    if (s.kind === 'kumo') return touchKumo(s);
    if (isStunned()) { missTap(s.x, s.y); return false; } // しびれているあいだは とれない
    s.caught = true;
    const idx = stars.indexOf(s);
    if (idx >= 0) stars.splice(idx, 1);
    const pts = s.kind === 'gold' ? CONFIG.GOLD_POINTS : s.kind === 'shoot' ? CONFIG.SHOOT_POINTS : CONFIG.NORMAL_POINTS;
    score += pts;
    burst(s.x, s.y, s.gold, true, pts);
    if (s.kind === 'gold') Sound.gold();
    else if (s.kind === 'shoot') Sound.shoot();
    else Sound.kiran();
    updateHud(true);
    if (score >= CONFIG.GOAL) finishClear();
    return true;
  }

  // かみなりぐもにさわった：少しのあいだ しびれて星がとれない（点数はへらない）
  function touchKumo(s) {
    if (isStunned()) return false;
    s.caught = true;
    const idx = stars.indexOf(s);
    if (idx >= 0) stars.splice(idx, 1);
    stunUntil = elapsed + CONFIG.STUN_TIME;
    zap(s.x, s.y);
    Sound.biri();
    return true;
  }

  function starAt(x, y) {
    // 判定内の星のうち、いちばん近いものを選ぶ（金色の星を少し優先）
    let best = null, bestD = Infinity, kumo = null;
    for (const s of stars) {
      if (s.caught) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d > s.hit) continue;
      if (s.kind === 'kumo') { kumo = kumo || s; continue; }
      const sc = d / s.hit - (s.gold ? 0.15 : 0);
      if (sc < bestD) { bestD = sc; best = s; }
    }
    // 近くに星があれば星を優先（かみなりぐもは、ちゃんとさわったときだけ）
    return best || kumo;
  }

  function onPointerDown(e) {
    if (state !== 'play') return;
    e.preventDefault();
    // 画面上の表示サイズとゲームの座標がずれていても、見えている場所で判定する
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (rect.width ? W / rect.width : 1);
    const y = (e.clientY - rect.top) * (rect.height ? H / rect.height : 1);
    const s = starAt(x, y);
    if (s) catchStar(s);
    else missTap(x, y);
  }

  function onKeyDown(e) {
    if (e.key === 'm' || e.key === 'M') { toggleSound(); return; }
    if (state !== 'play') return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (e.repeat) return;
      // キーボード：いちばん下にある（見えている）星をキャッチ
      let target = null;
      for (const s of stars) {
        if (s.caught || s.kind === 'kumo' || s.y < s.r * 0.5 || s.y > H) continue;
        if (!target || s.y > target.y) target = s;
      }
      if (target) catchStar(target);
    }
  }

  function toggleSound() {
    const on = !Sound.enabled;
    Sound.setEnabled(on);
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', on ? 'おと オン（おすと おとが きえます）' : 'おと オフ（おすと おとが でます）');
    soundBtn.querySelector('.sound-label').textContent = on ? 'おと オン' : 'おと オフ';
  }

  function toggleVibe() {
    const on = !Vibe.enabled;
    Vibe.enabled = on;
    vibeBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    vibeBtn.setAttribute('aria-label', on ? 'ぶるぶる オン（おすと とまります）' : 'ぶるぶる オフ（おすと ふるえます）');
    vibeBtn.querySelector('.vibe-label').textContent = on ? 'ぶるぶる オン' : 'ぶるぶる オフ';
    if (on) Vibe.buzz(30); // オンにしたことが手でわかるように
    else { try { navigator.vibrate(0); } catch (e) { /* なにもしない */ } }
  }

  /* ---------------------------------------------------------
     エフェクト
     --------------------------------------------------------- */
  const SPARK_COLORS = ['#ffe18a', '#fff5d5', '#f6a9ca', '#91cde5', '#f5d2b1'];
  const GOLD_COLORS = ['#f4b64d', '#ffe18a', '#f4b64d', '#fff5d5'];

  function burst(x, y, gold, withText, pts) {
    const few = reduced();
    particles.push({ type: 'ring', x, y, life: 0, max: 0.45, r: starR * (gold ? 1.3 : 0.9), gold });
    const n = few ? (gold ? 6 : 4) : (gold ? 16 : 9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const sp = rand(90, gold ? 260 : 190);
      particles.push({
        type: 'spark', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, max: rand(0.45, 0.75),
        r: rand(4, gold ? 10 : 7),
        color: (gold ? GOLD_COLORS : SPARK_COLORS)[i % (gold ? GOLD_COLORS : SPARK_COLORS).length],
      });
    }
    if (withText) {
      particles.push({ type: 'text', x, y: y - starR * 0.4, life: 0, max: 0.9, text: '+' + pts, gold, pts });
      onCatch(x, y, gold);
    }
  }

  /* ---------------------------------------------------------
     第1弾の演出：虹が育つ・天使の応援・♪・集めた星で75
     （見た目と音だけ。点数・時間・星の出かた・判定は変えない）
     --------------------------------------------------------- */
  const NEAR_MISS = 10; // 時間切れのとき、のこりがこの数以下なら「あと ○こ だったね！」
  const CHEERS = [[25, 'いいかんじ！'], [50, 'きらきら いっぱい！'], [60, 'あと すこし！']];

  function onCatch(x, y, gold) {
    caughtLog.push({ x, y, gold });
    if (gold) Vibe.gold(); else Vibe.catch(); // れんぞくのぶるぶるが あとから上書きする
    comboOnCatch(x, y);
    // ♪（音がオフでも、曲が進んでいることがわかるように）
    particles.push({ type: 'note', x: x + starR * 0.7, y: y - starR * 0.2, life: 0, max: 1.0 });
    // 取った星から、虹の先っぽへ小さな光が飛んでいく
    if (!reduced()) {
      const tip = rainbowTip(Math.min(score, CONFIG.GOAL) / CONFIG.GOAL);
      particles.push({ type: 'glow', x, y, sx: x, sy: y, tx: tip.x, ty: tip.y, life: 0, max: 0.55 });
    }
    cheer.hopUntil = clock + 0.3;
    if (gold) {
      // 金色の星を取った場所に、大きなドットの花が咲く
      // 「+5」より後ろに描くので、配列の先頭に入れる
      particles.unshift({ type: 'bloom', x, y, life: 0, max: 1.3, scale: Math.max(7, Math.round(starR / 3.2)) });
      headline({ type: 'text', x, y: y - starR * 1.6, life: 0, max: 1.1, text: 'きんいろ ゲット！', size: Math.round(clamp(starR * 0.6, 15, 24)), color: '#c97a00' });
    }
  }

  // ことばは天使のふきだし1か所だけ。いま出ているものより大事なことばだけが上書きできる
  // prio  1：がんばってね・れんぞくのほめ言葉  2：とちゅうの応援  3：あと○こ・だいじょうぶ
  function angelSay(text, sec, prio) {
    if (clock < cheer.until && prio < cheer.prio) return;
    cheer.text = text;
    cheer.until = clock + sec;
    cheer.prio = prio;
    cheer.countdown = false;
  }
  // 大きな見出し（「○○が そろった！」「きんいろ ゲット！」）は、画面に1つだけ
  function headline(p) {
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].head) particles.splice(i, 1);
    p.head = true;
    particles.push(p);
  }

  function updateCheer(dt) {
    const sc = Math.min(score, CONFIG.GOAL);
    const target = sc / CONFIG.GOAL;
    rainbowShown += (target - rainbowShown) * Math.min(1, dt * 4);
    if (Math.abs(target - rainbowShown) < 0.002) rainbowShown = target;
    // 虹の1だんが そろうたびに お祝い（6だんめは75達成のお祝いになる）
    const nowBands = Math.floor(rainbowShown * RAINBOW_BANDS + 1e-6);
    while (bandsDone < nowBands && bandsDone < RAINBOW_BANDS - 1) { bandClear(bandsDone); bandsDone++; }
    if (!cheer.said.start && elapsed > 0.4) { cheer.said.start = true; angelSay('がんばってね！', 1.6, 1); }
    for (const [mark, text] of CHEERS) {
      if (sc >= mark && !cheer.said[mark]) {
        cheer.said[mark] = true;
        angelSay(text, 2, 2);
      }
    }
    if (sc >= 70 && !cheer.said[70]) { cheer.said[70] = true; angelSay('', 2.5, 3); cheer.countdown = true; }
    // 「あと ○こ！」は取るたびに数がへっていく
    if (cheer.countdown && clock < cheer.until) cheer.text = 'あと ' + (CONFIG.GOAL - sc) + 'こ！';
    else cheer.countdown = false;
    const st = isStunned();
    if (st && !cheer.wasStunned) angelSay('だいじょうぶ！', 1.5, 3);
    cheer.wasStunned = st;
  }

  // プレイ中の虹（画面の下に大きく。星より後ろ）
  function playRainbowGeom() {
    const R = Math.round(Math.min(W * 0.46, H * 0.34));
    return { cx: W / 2, cy: H - 36, R, thick: Math.max(8, R * 0.075) };
  }
  // いま色がついている「だん」の先っぽ
  function rainbowTip(prog) {
    const g = playRainbowGeom();
    const bp = clamp(prog, 0, 1) * RAINBOW_BANDS;
    const b = Math.min(RAINBOW_BANDS - 1, Math.floor(bp + 1e-6));
    const x = g.cx - g.R + 2 * g.R * clamp(bp - b, 0, 1);
    const rr = g.R - g.thick * (b + 0.5);
    const dx = clamp(x - g.cx, -rr, rr);
    return { x, y: g.cy - Math.sqrt(rr * rr - dx * dx) };
  }
  // 虹は6つの「だん」。外がわ（ピンク）から順に、1だんずつ左から色がつく
  const RAINBOW_BANDS = 6;
  const BAND_COLORS = ['#e98694', '#f4b64d', '#ffe18a', '#7fad98', '#669dbc', '#9986b8'];
  const BAND_NAMES = ['ピンク', 'オレンジ', 'きいろ', 'みどり', 'あお', 'むらさき'];
  let bandCache = null;
  function playBandCanvases() {
    const geo=playRainbowGeom();if(bandCache&&bandCache.R===geo.R&&bandCache.dpr===DPR)return bandCache.list;
    const w=geo.R*2+12,h=geo.R+12,list=[];
    const colors=['#ff94b8','#ffbd86','#ffe18c','#8edbb5','#91c9f7','#baa6ec'];
    for(let b=0;b<RAINBOW_BANDS;b++){
      const [c,g]=offscreen(w,h);g.lineCap='round';g.lineWidth=geo.thick*.9;g.strokeStyle=colors[b];
      g.beginPath();g.arc(geo.R+6,geo.R+6,geo.R-geo.thick*(b+.5),Math.PI,Math.PI*2);g.stroke();
      list.push({c,w,h});
    }bandCache={R:geo.R,dpr:DPR,list};return list;
  }
  function drawPlayRainbow() {
    const g = playRainbowGeom(), list = playBandCanvases();
    const x0 = g.cx - g.R - 6, y0 = g.cy - g.R - 6;
    const bp = clamp(rainbowShown, 0, 1) * RAINBOW_BANDS;
    const done = Math.floor(bp + 1e-6), sub = bp - done;
    ctx.save();
    list.forEach((bc,b)=>{
      ctx.save();const event=particles.find(p=>p.head&&p.text===BAND_NAMES[b]+'が そろった！'&&p.life<.5);
      if(event&&!reduced()){const k=Math.sin(event.life/.5*Math.PI*2)*.012;ctx.translate(g.cx,g.cy);ctx.scale(1+k,1-k);ctx.translate(-g.cx,-g.cy);}
      // できあがりの形をうっすら見せておく
      ctx.globalAlpha = 0.13;
      ctx.drawImage(bc.c, x0, y0, bc.w, bc.h);
      if (b < done) {
        ctx.globalAlpha = 0.7;
        ctx.drawImage(bc.c, x0, y0, bc.w, bc.h);
      } else if (b === done && sub > 0.002) {
        const sw = Math.max(1, Math.floor(bc.c.width * sub));
        ctx.globalAlpha = 0.7;
        ctx.drawImage(bc.c, 0, 0, sw, bc.c.height, x0, y0, bc.w * sw / bc.c.width, bc.h);
        // あと少しでそろう：のこりの部分が ゆっくり光って知らせる（はげしい点滅はしない）
        if (sub >= 0.75 && bc.c.width - sw >= 1) {
          ctx.globalAlpha = reduced() ? 0.3 : 0.2 + 0.14 * Math.sin(clock * 4);
          ctx.drawImage(bc.c, sw, 0, bc.c.width - sw, bc.c.height, x0 + bc.w * sw / bc.c.width, y0, bc.w * (bc.c.width - sw) / bc.c.width, bc.h);
        }
      }
      ctx.restore();
    });
    ctx.restore();
  }
  // 虹の1だんが そろった！
  function bandClear(b) {
    const g = playRainbowGeom();
    const rr = g.R - g.thick * (b + 0.5);
    const n = reduced() ? 6 : 16;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + Math.PI * (i + 0.5) / n;
      const sp = reduced() ? 0 : rand(30, 90);
      particles.push({ type: 'spark', x: g.cx + Math.cos(a) * rr, y: g.cy + Math.sin(a) * rr, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0, max: 0.9, r: rand(6, 10), color: i % 2 ? '#fff5d5' : BAND_COLORS[b] });
    }
    headline({ type: 'text', x: g.cx, y: g.cy - g.R - 22, life: 0, max: 1.5, text: BAND_NAMES[b] + 'が そろった！', size: Math.round(clamp(Math.min(W, H) * 0.06, 18, 30)), color: '#273455' });
    cheer.hopUntil = clock + 0.3;
    Sound.band();
    Vibe.band();
  }

  // れんぞくキャッチ：続けて取るほど、キラキラとほめ言葉が大きくなる（続かなくても何も起きない）
  const COMBO_WINDOW = 1.2; // この秒数のうちに次の星を取ると「れんぞく」
  const COMBO_STEPS = [[3, 'いいね！', '#e98694'], [5, 'すごい！', '#f4b64d'], [8, 'すごすぎ！', '#669dbc'], [12, 'さいこう！', '#9986b8']];
  function comboOnCatch(x, y) {
    combo.count = elapsed - combo.last <= COMBO_WINDOW ? combo.count + 1 : 1;
    combo.last = elapsed;
    // ちょうど 3・5・8・12こめ、そのあとは4こごとに ほめ言葉
    let step = COMBO_STEPS.find(st => st[0] === combo.count);
    if (!step && combo.count > 12 && combo.count % 4 === 0) step = COMBO_STEPS[COMBO_STEPS.length - 1];
    if (!step) return;
    const k = COMBO_STEPS.indexOf(step);
    if (!reduced()) {
      const n = 6 + k * 2, sp = 90 + k * 25;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        particles.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.5, r: 4 + k, color: step[2] });
      }
    }
    angelSay(step[1], 1.0, 1);
    cheer.hopUntil = clock + 0.3;
    Sound.combo(k + 1);
    Vibe.combo();
  }

  // プレイ中の天使（左下。星より後ろに描くので、タッチのじゃまをしない）
  function drawCheerAngel() {
    const s = clamp(Math.min(W, H) * 0.16, 52, 84);
    const x = 14 + s * 0.5;
    const yBase = H - 34 - s * 0.5;
    let hop = 0;
    if (!reduced() && clock < cheer.hopUntil) hop = Math.sin(((cheer.hopUntil - clock) / 0.3) * Math.PI) * s * 0.18;
    const bob = reduced() ? 0 : Math.sin(clock * 2) * 2;
    const talking = clock < cheer.until && cheer.text;
    drawAngel(ctx, x, yBase - hop + bob, s, clock, !!talking);
    if (talking) drawBubble(cheer.text, x - s * 0.35, yBase - s * 0.62 - hop);
  }
  function drawBubble(text,x,bottom) {
    ctx.save();const fs=clamp(Math.round(Math.min(W,H)*.045),16,20);ctx.font='800 '+fs+'px Meiryo,sans-serif';
    const pw=Math.ceil(ctx.measureText(text).width)+26,ph=fs+22,bx=clamp(x,8,W-pw-8),by=bottom-ph-8;
    ctx.shadowColor='rgba(114,86,144,.12)';ctx.shadowBlur=8;ctx.shadowOffsetY=4;roundRectPath(ctx,bx,by,pw,ph,ph/2);ctx.fillStyle='#ffffff';ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='#baa6dc';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(bx+22,by+ph-2);ctx.quadraticCurveTo(bx+12,by+ph+12,bx+13,by+ph-3);ctx.fill();
    ctx.fillStyle='#51456d';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(text,bx+13,by+ph/2);ctx.restore();
  }

  /* ---------------------------------------------------------
     第2弾：始まりを元気に・金色の花・園庭の花
     --------------------------------------------------------- */
  // 始まってすぐ取れるように、さいしょの3つは画面の上のほうから落ちはじめる
  function welcomeStars() {
    const ys = [0.14, 0.27, 0.4];
    for (const fy of ys) {
      spawnStar();
      const st = stars[stars.length - 1];
      if (st) st.y = H * fy;
    }
  }

  // 花のドット絵（p=花びら c=まんなか g=くき・は）
  const BIG_FLOWER_ROWS = ['..p.p.p..', '.ppppppp.', 'pppcccppp', '.ppcccpp.', 'pppcccppp', '.ppppppp.', '..p.p.p..'];
  const FLOWER_ROWS = ['..ppp..', '.ppcpp.', '..ppp..', '...g...', '.g.g...', '..gg.g.', '...gg..', '...g...'];
  const RAINBOW_FLOWER_ROWS = ['..rob..', '.vrcoy.', '..gyb..', '...g...', '.g.g...', '..gg.g.', '...gg..', '...g...'];
  const FLOWER_TYPES = [
    { p: '#e98694', c: '#ffe18a' },  // ピンク
    { p: '#ffe18a', c: '#94604d' },  // きいろ
    { p: '#91cde5', c: '#fff5d5' },  // みずいろ
    { p: '#f4b64d', c: '#e98694' },  // オレンジ
    { p: '#fff5d5', c: '#f4b64d' },  // しろ
    { p: '#9986b8', c: '#ffe18a' },  // むらさき
  ];
  function flowerSprite(n,scale) {
    const key='flower:'+n%60+':'+scale;if(popCache.has(key))return popCache.get(key);
    const c=document.createElement('canvas');c.width=70*scale;c.height=80*scale;const g=c.getContext('2d');g.scale(10*scale,10*scale);
    g.lineCap='round';g.strokeStyle='#70ac93';g.lineWidth=.42;g.beginPath();g.moveTo(3.5,3.4);g.quadraticCurveTo(3.2,5.2,3.5,7.7);g.stroke();
    g.save();g.translate(2.7,5.5);g.rotate(.55);popOval(g,0,0,1,.4,'#9ed4ac');g.restore();g.save();g.translate(4.2,6.3);g.rotate(-.55);popOval(g,0,0,1,.4,'#7dc5a1');g.restore();
    const type=FLOWER_TYPES[(n-1)%FLOWER_TYPES.length];
    for(let i=0;i<6;i++){const a=i*Math.PI/3;g.save();g.translate(3.5+Math.cos(a)*1.25,2.5+Math.sin(a)*1.15);g.rotate(a);g.beginPath();g.ellipse(0,0,1,.8,0,0,Math.PI*2);g.fillStyle=n%10===0?BAND_COLORS[i]:type.p;g.fill();g.strokeStyle='#9b80a544';g.lineWidth=.12;g.stroke();popOval(g,-.25,-.22,.25,.12,'#ffffffaa');g.restore();}
    popOval(g,3.5,2.5,.7,.7,type.c);popOval(g,3.3,2.25,.2,.12,'#ffffffbb');popCache.set(key,c);return c;
  }
  function loadGarden() {
    try { gardenCount = Math.max(0, parseInt(localStorage.getItem('ohoshi-garden') || '0', 10) || 0); } catch (e) { gardenCount = 0; }
  }
  function addFlower(at) {
    gardenCount++;
    gardenBloomAt = at;
    try { localStorage.setItem('ohoshi-garden', String(gardenCount)); } catch (e) { /* 保存できなくても遊べる */ }
  }
  // 結果の画面の下（右下のNetlifyマークをよけて、左から）に花をならべる
  function gardenLayout() {
    const sc = H < 450 ? 2 : 3, fw = 7 * sc, gap = sc * 2, ground = H - 12;
    const usable = Math.max(fw * 4, W - 210);
    const cap = Math.max(4, Math.floor((usable - 12) / (fw + gap)));
    const first = Math.max(1, gardenCount - cap + 1);
    return { sc, fw, gap, ground, usable, first, slotX: (n) => 12 + (n - first) * (fw + gap) };
  }

  // 今回咲いた花を、まず天使のとなりに大きく見せる（文字や画面のボタンにかさならない場所だけ）
  const SHOW_GROW = 0.5, SHOW_HOLD = 2.2, SHOW_FLY = 0.8;
  // 園庭へ飛んでいくあいだは、文字のまどの上を通るので、ゲーム画面とは別の小さな絵にする
  let flyEl = null, flyUsed = false, flyN = 0;
  function flyFlower(c, n, x, y, w, h) {
    if (!flyEl) {
      flyEl = document.createElement('canvas');
      flyEl.setAttribute('aria-hidden', 'true');
      flyEl.style.cssText = 'position:absolute;z-index:25;pointer-events:none;image-rendering:auto;';
      app.appendChild(flyEl);
    }
    if (flyN !== n) {
      flyN = n;
      flyEl.width = c.width; flyEl.height = c.height;
      const g = flyEl.getContext('2d');
      g.clearRect(0, 0, c.width, c.height); g.drawImage(c, 0, 0);
    }
    flyEl.style.left = Math.round(x) + 'px'; flyEl.style.top = Math.round(y) + 'px';
    flyEl.style.width = Math.round(w) + 'px'; flyEl.style.height = Math.round(h) + 'px';
    flyEl.style.display = 'block';
    flyUsed = true;
  }
  function flowerShowSpot() {
    const slot = slots[state];
    if (!slot) return null;
    const appRect = app.getBoundingClientRect();
    const avoid = [...screens[state].children, soundBtn, vibeBtn]
      .filter(el => !el.classList.contains('angel-slot'))
      .map(el => el.getBoundingClientRect())
      .filter(r => r.width && r.height)
      .map(r => ({ l: r.left - appRect.left, t: r.top - appRect.top, r: r.right - appRect.left, b: r.bottom - appRect.top }));
    avoid.push({ l: W - 210, t: H - 74, r: W, b: H }); // Netlifyのマーク
    const labelH = 30;
    // 大きいほうから順に、天使の右→左、少しずつ下へずらして、空いている場所をさがす
    for (let sc = clamp(Math.round(slot.s * 0.7 / 7), 4, 11); sc >= 4; sc--) {
      const w = 7 * sc, h = 8 * sc;
      for (let dy = 0; dy <= slot.s * 0.6; dy += 8) {
        for (const side of [1, -1]) {
          const cx = slot.x + side * (slot.s * 0.42 + w * 0.5 + 6);
          const top = slot.y + dy - h * 0.5 - labelH, bottom = slot.y + dy + h * 0.5;
          const box = { l: cx - Math.max(w, 150) / 2, t: top, r: cx + Math.max(w, 150) / 2, b: bottom };
          if (box.l < 6 || box.r > W - 6 || box.t < 6 || box.b > H - 6) continue;
          if (avoid.some(a => box.l < a.r && box.r > a.l && box.t < a.b && box.b > a.t)) continue;
          return { x: cx, y: bottom, sc, w, h };
        }
      }
    }
    return null;
  }

  function drawGarden() {
    if (!gardenCount) return;
    const G = gardenLayout(), { sc, fw, ground } = G;
    const since = sceneT - gardenBloomAt;
    const spot = flowerShowSpot();
    // spot があるとき：大きく見せる → 園庭へ飛んでいく（動き軽減のときは、となりに出したまま）
    const flyEnd = SHOW_GROW + SHOW_HOLD + SHOW_FLY;
    const showing = spot && since >= 0 && (reduced() || since < flyEnd);
    const grow = reduced() ? 1 : clamp(since / 0.6, 0, 1);
    for (let n = G.first; n <= gardenCount; n++) {
      const newest = n === gardenCount;
      if (newest && (since < 0 || showing)) continue;
      const c = flowerSprite(n, sc);
      const x = G.slotX(n);
      const k = newest && !spot ? easeOutBack(grow) : 1;
      if (k <= 0) continue;
      const h = Math.round(8 * sc * k);
      drawPixel(ctx, c, x, ground - h, 7 * sc, h);
      if (newest && !spot && grow > 0 && grow < 1 && !reduced()) {
        sparkle(ctx, x + fw / 2 + Math.sin(sceneT * 9) * fw, ground - 8 * sc - 4, 5, '#fff5d5', 1 - grow);
      }
    }
    if (showing) drawFlowerShow(spot, since, G);
    // ことば（大人むけの小さなまど）。背の低い横画面では場所がないので花だけ
    const labelAt = spot ? flyEnd : 0;
    if (since < labelAt || H <= 560 || (spot && reduced())) return;
    const text = !spot && since < 2.2 ? 'おはなが さいたよ！' : 'つぎは どんな おはなかな？';
    ctx.save();
    let fs = 13;
    ctx.font = '700 ' + fs + 'px "Hiragino Maru Gothic ProN", "BIZ UDPGothic", Meiryo, sans-serif';
    while (fs > 10 && ctx.measureText(text).width + 16 > G.usable) { fs--; ctx.font = '700 ' + fs + 'px "Hiragino Maru Gothic ProN", "BIZ UDPGothic", Meiryo, sans-serif'; }
    const tw = Math.ceil(ctx.measureText(text).width) + 16, th = fs + 10;
    const bx = 10, by = ground - 8 * sc - th - 6;
    ctx.globalAlpha = clamp((since - labelAt) / 0.3, 0, 1);
    popLabel(ctx,text,bx,by,fs);
    ctx.restore();
  }

  function drawFlowerShow(spot, since, G) {
    const rm = reduced();
    const flyT = rm ? 0 : clamp((since - SHOW_GROW - SHOW_HOLD) / SHOW_FLY, 0, 1);
    const e = flyT < 0.5 ? 2 * flyT * flyT : 1 - Math.pow(-2 * flyT + 2, 2) / 2;
    const sc = lerp(spot.sc, G.sc, e);
    const c = flowerSprite(gardenCount, 1);
    const k = rm ? 1 : easeOutBack(clamp(since / SHOW_GROW, 0, 1));
    const w = 7 * sc, h = 8 * sc * k;
    const bob = rm || flyT > 0 ? 0 : Math.sin(clock * 2.4) * 3;
    const cx = lerp(spot.x, G.slotX(gardenCount) + G.fw / 2, e);
    const bottom = lerp(spot.y, G.ground, e) + bob;
    if (flyT > 0 && flyT < 1) flyFlower(c, gardenCount, cx - w / 2, bottom - h, w, h);
    else if (h > 0) drawPixel(ctx, c, Math.round(cx - w / 2), Math.round(bottom - h), Math.round(w), Math.round(h));
    // まわりのキラキラ（ゆっくり。点滅はしない）
    if (!rm && k > 0.5) {
      for (let i = 0; i < 4; i++) {
        const a = clock * 1.2 + i * Math.PI / 2;
        sparkle(ctx, cx + Math.cos(a) * w * 0.75, bottom - h * 0.6 + Math.sin(a) * h * 0.55, 4 + spot.sc * 0.4, i % 2 ? '#fff5d5' : '#ffe18a', 0.9 * (1 - flyT));
      }
    }
    // 「おはなが さいたよ！」（大きく見せているあいだだけ）
    if (flyT > 0 || since < SHOW_GROW * 0.6) return;
    const text = 'おはなが さいたよ！';
    ctx.save();
    const fs = clamp(Math.round(Math.min(W, H) * 0.036), 13, 17);
    ctx.font = '700 ' + fs + 'px "Hiragino Maru Gothic ProN", "BIZ UDPGothic", Meiryo, sans-serif';
    const tw = Math.ceil(ctx.measureText(text).width) + 14, th = fs + 10;
    const bx = Math.round(clamp(cx - tw / 2, 6, W - tw - 6)), by = Math.round(bottom - spot.h - th - 8);
    popLabel(ctx,text,bx,by,fs);
    ctx.restore();
  }

  // ♪のドット絵
  const NOTE_ROWS = ['....oo.', '....oyo', '....o.o', '....o..', '.oooo..', 'oyyyo..', 'oyyyo..', '.ooo...'];

  // お祝い：取った星が飛んできて「75」になる
  function big75Layout() {
    const art = document.querySelector('.celebration-art').getBoundingClientRect();
    const appRect = app.getBoundingClientRect();
    const x = art.left - appRect.left + art.width / 2, y = art.top - appRect.top;
    const target = H > W ? W * .56 : Math.min(art.width * .72, 248);
    const p = Math.max(8, Math.ceil(target / 11));
    return { x, y, art, p, yy: y + art.height * .02 };
  }
  function big75Cells(L) {
    return pop75(L.p).cells.map(([x,y])=>({x:L.x-11*L.p/2+x*L.p,y:L.yy+y*L.p}));
  }
  function buildFlyers() {
    flyers = [];
    if (reduced() || !caughtLog.length) return;
    const cellCount = big75Cells(big75Layout()).length;
    const list = caughtLog.slice(-75);
    const n = list.length, step = Math.min(0.05, 0.9 / n);
    list.forEach((c, j) => {
      const cells = [];
      if (n >= cellCount) cells.push(j % cellCount);
      else for (let k = 0; k < cellCount; k++) if (Math.floor(k * n / cellCount) === j) cells.push(k);
      const t0 = 0.25 + j * step;
      flyers.push({ sx: c.x, sy: c.y, gold: c.gold, cells, t0, t1: t0 + 0.85, arrived: false });
    });
  }
  function renderFlyers(t, L) {
    const cells = big75Cells(L), edge = Math.max(2, Math.round(L.p * .25));
    // 着いた星の分だけ「75」のマスが光る
    const lit = [];
    for (const f of flyers) {
      if (!f.arrived && t >= f.t1) {
        f.arrived = true;
        const c = cells[f.cells[0]];
        if (c) for (let i = 0; i < 3; i++) particles.push({ type: 'spark', x: c.x + L.p / 2, y: c.y + L.p / 2, vx: rand(-80, 80), vy: rand(-80, 40), life: 0, max: 0.5, r: rand(4, 7), color: '#fff5d5' });
      }
      if (f.arrived) for (const i of f.cells) lit.push(cells[i]);
    }
    const done = flyers.every(f => f.arrived);
    if(!done&&lit.length){ctx.save();ctx.beginPath();for(const c of lit)if(c)ctx.rect(c.x-edge,c.y-edge,L.p+edge*2,L.p+edge*2);ctx.clip();drawPop75(ctx,L.x,L.yy,L.p);ctx.restore();}
    // 飛んでいる星
    for (const f of flyers) {
      if (f.arrived || t < f.t0) continue;
      const c = cells[f.cells[0]];
      if (!c) continue;
      const k = clamp((t - f.t0) / (f.t1 - f.t0), 0, 1);
      const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const tx = c.x + L.p / 2, ty = c.y + L.p / 2;
      const mx = (f.sx + tx) / 2, my = Math.min(f.sy, ty) - 120;
      const px = (1 - e) * (1 - e) * f.sx + 2 * (1 - e) * e * mx + e * e * tx;
      const py = (1 - e) * (1 - e) * f.sy + 2 * (1 - e) * e * my + e * e * ty;
      const sp = f.gold ? sprites.gold : sprites.normal;
      const size = Math.max(16, L.p * 1.25);
      ctx.drawImage(sp.canvas, Math.round(px - size / 2), Math.round(py - size / 2), size, size);
    }
    return done;
  }

  function missTap(x, y) {
    // はずれても小さなキラキラ（減点なし）
    particles.push({ type: 'ring', x, y, life: 0, max: 0.3, r: 14, gold: false, faint: true });
  }

  function puff(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      particles.push({ type: 'puff', x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 15, life: 0, max: 0.6, r: starR * rand(0.3, 0.5) });
    }
  }

  function zap(x, y) {
    puff(x, y, reduced() ? 4 : 8);
    for (let i = 0; i < 3; i++) {
      particles.push({ type: 'bolt', x: x + (i - 1) * starR * 0.8, y: y + starR * (0.2 + (i % 2) * 0.25), life: 0, max: 0.7, r: starR * 0.55 });
    }
    particles.push({ type: 'text', x, y: y - starR * 0.7, life: 0, max: 1.1, text: 'びりびり', size: Math.round(clamp(starR * 0.7, 16, 28)), color: '#6a5fa8' });
  }

  function addConfetti(fromTop) {
    const big = Math.random() < 0.3;
    particles.push({
      type: 'confetti',
      x: rand(W * 0.04, W * 0.96),
      y: fromTop ? rand(-40, -10) : rand(H * 0.1, H * 0.9),
      vx: rand(-20, 20),
      vy: rand(50, 110),
      life: 0,
      max: rand(4, 7),
      r: big ? rand(9, 14) : rand(5, 8),
      rot: rand(0, 6.28),
      vr: rand(-2, 2),
      color: Math.random() < 0.45 ? '#f4b64d' : RAINBOW[(Math.random() * RAINBOW.length) | 0],
      sw: rand(0.5, 1.5),
      ph: rand(0, 6.28),
    });
  }

  /* ---------------------------------------------------------
     HUD
     --------------------------------------------------------- */
  function updateHud(bump) {
    const shown = Math.min(score, CONFIG.GOAL);
    scoreEl.textContent = String(shown);
    gaugeEl.style.width = (shown / CONFIG.GOAL) * 100 + '%';
    if (bump) {
      scoreEl.classList.remove('bump');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('bump');
    }
    updateTime();
  }

  function updateTime() {
    const remain = Math.max(0, CONFIG.GAME_TIME - elapsed);
    const sec = Math.ceil(remain);
    if (sec !== lastShownTime) {
      lastShownTime = sec;
      timeEl.textContent = String(sec);
      ringEl.classList.toggle('low', sec <= 10);
    }
    ringEl.style.strokeDashoffset = String(RING_LEN * (1 - remain / CONFIG.GAME_TIME));
  }

  /* ---------------------------------------------------------
     更新
     --------------------------------------------------------- */
  function update(dt) {
    clock += dt;
    sceneT += dt;

    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.v > 0 && c.x - c.w / 2 > W) c.x = -c.w / 2;
      if (c.v < 0 && c.x + c.w / 2 < 0) c.x = W + c.w / 2;
    }

    if (state === 'play') {
      elapsed += dt;
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnStar();
        spawnTimer += lerp(CONFIG.SPAWN_INTERVAL_START, CONFIG.SPAWN_INTERVAL_END, progress()) * rand(0.85, 1.15);
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.y += s.vy * dt;
        s.baseX += s.vx * dt;
        s.x = s.baseX + Math.sin(s.phase + clock * s.swayF) * s.sway;
        if (reduced()) s.rot = 0;
        else if (s.kind === 'shoot') s.rot += dt * 5;
        else s.rot = Math.sin(s.phase + clock * 1.3) * 0.18;
        // とれなかった星はそのまま消える（減点なし）
        if (s.y - s.r * 1.3 > H || s.x < -s.r * 2 || s.x > W + s.r * 2) stars.splice(i, 1);
      }
      updateTime();
      updateCheer(dt);
      if (elapsed >= CONFIG.GAME_TIME && state === 'play') finishTimeup();
    }

    if (state === 'title' || state === 'level') {
      // かざりの星がゆっくり落ちる
      if (decoStars.length < 4 && Math.random() < dt * 0.6) {
        decoStars.push({ x: rand(W * 0.08, W * 0.92), y: -30, vy: rand(25, 45), ph: rand(0, 6.28), gold: Math.random() < 0.2 });
      }
    }
    for (let i = decoStars.length - 1; i >= 0; i--) {
      const d = decoStars[i];
      d.y += d.vy * dt;
      if (d.y > H + 40 || state === 'play') decoStars.splice(i, 1);
    }

    if (state === 'clear') {
      const rate = reduced() ? 5 : (sceneT < 1.2 ? 45 : 18);
      if (sceneT > 0.3 && particles.length < (reduced() ? 50 : 170)) {
        let n = rate * dt;
        while (n > 0) { if (Math.random() < n) addConfetti(sceneT > 1.2); n -= 1; }
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) { particles.splice(i, 1); continue; }
      if (p.type === 'spark') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.pow(0.04, dt); p.vy = p.vy * Math.pow(0.04, dt) + 60 * dt;
      } else if (p.type === 'text') {
        p.y -= 50 * dt;
      } else if (p.type === 'note') {
        if (!reduced()) p.y -= 34 * dt;
      } else if (p.type === 'puff') {
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else if (p.type === 'confetti') {
        p.y += p.vy * dt;
        p.x += p.vx * dt + Math.sin(p.ph + p.life * 2) * 18 * p.sw * dt;
        p.rot += p.vr * dt;
        if (p.y > H + 30) p.life = p.max;
      }
    }
  }

  /* ---------------------------------------------------------
     描画
     --------------------------------------------------------- */
  function render() {
    flyUsed = false;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bgCanvas, 0, 0, W, H);

    // ゆっくりまたたく小さな光（点滅はおだやかに）
    for (const tw of twinkles) {
      const a = reduced() ? 0.5 : 0.35 + 0.35 * Math.sin(tw.p + clock * tw.sp);
      sparkle(ctx, tw.x * W, tw.y * H, tw.r, '#fff5d5', a);
    }
    for (const c of clouds) {
      ctx.globalAlpha = c.a;
      drawCloudPile(ctx, reduced() ? (clouds.indexOf(c)+.5)*W/clouds.length : c.x, c.y, c.w);
    }
    ctx.globalAlpha = 1;

    if (state === 'title' || state === 'level') renderTitle(state);
    else if (state === 'intro') { ctx.fillStyle = 'rgba(255,190,151,0.18)'; ctx.fillRect(0, 0, W, H); }
    else if (state === 'play') renderPlay();
    else if (state === 'clear') renderClear();
    else if (state === 'timeup') renderTimeup();

    if(state!=='clear') renderParticles();
    if (flyEl && !flyUsed) flyEl.style.display = 'none';
  }

  function renderTitle(name) {
    const slot = slots[name] || (name === 'title' ? { x: W / 2, y: H * 0.2, s: H * 0.2 } : null);
    const R = Math.min(W * 0.48, H * 0.36);
    if (slot) {
      drawRainbow(ctx, W / 2, slot.y + R * 0.7, R, R * 0.075, 1, 0.75);
      drawCloudPile(ctx, W / 2 - R * 0.95, slot.y + R * 0.72, R * 0.6);
      drawCloudPile(ctx, W / 2 + R * 0.95, slot.y + R * 0.72, R * 0.6);
    }
    for (const d of decoStars) {
      const sp = d.gold ? sprites.gold : sprites.normal;
      ctx.save();
      ctx.translate(d.x + (reduced()?0:Math.sin(d.ph + clock)*10), reduced()?H*.12:d.y);
      ctx.globalAlpha = reduced() ? 0 : 0.9;
      ctx.drawImage(sp.canvas, -sp.size / 2, -sp.size / 2, sp.size, sp.size);
      ctx.restore();
    }
    if (!slot) return;
    const bob = reduced() ? 0 : Math.sin(clock * 1.8) * slot.s * 0.04;
    drawAngel(ctx, slot.x, slot.y + bob - slot.s * 0.02, slot.s * 0.85, clock, true);
  }

  function renderPlay() {
    const stunned = isStunned();
    const oni = levelKey === 'oni';
    if (oni) {
      // ゆうやけ色の空（暗くしすぎない）
      ctx.fillStyle = 'rgba(255,190,151,0.18)';
      ctx.fillRect(0, 0, W, H);
    }
    drawPlayRainbow();
    drawCheerAngel();
    if (oni) drawOni();
    for (const s of stars) {
      if (s.kind === 'kumo') { drawKumo(s); continue; }
      ctx.save();
      ctx.globalAlpha = stunned ? 0.5 : 1; // しびれているあいだは うすく
      if (oni) drawFlame(s);
      else if (s.kind === 'shoot') drawTrail(s);
      const sp = sprites[s.kind];
      ctx.translate(s.x,s.y);
      if(!reduced()) { const squash=Math.sin(clock*2.8+s.phase)*.035;ctx.scale(1+squash,1-squash); }
      // ドットの輪郭を保つ（当たり判定・移動は原版のまま）

      ctx.drawImage(sp.canvas, -sp.size / 2, -sp.size / 2, sp.size, sp.size);
      ctx.restore();
      if (s.gold && !stunned) {
        // 金色の星のまわりを回るキラキラ
        for (let i = 0; i < 4; i++) {
          const a = clock * (reduced() ? 0 : 1.6) + s.phase + (i * Math.PI) / 2;
          const rr = s.r * 1.35;
          sparkle(ctx, s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, s.r * 0.22, '#fff5d5', 0.95);
        }
      }
    }
    if (stunned) drawStun();
  }

  // いんせきの ほのお（すすむ向きの反対がわに、ドットの火）
  const FLAME_COLORS = ['#fff5d5', '#ffe18a', '#f4b64d', '#e9786f'];
  function drawFlame(s) {
    const speed=Math.hypot(s.vx,s.vy)||1,ux=s.vx/speed,uy=s.vy/speed;ctx.save();
    for(let i=6;i>0;i--){ctx.globalAlpha=(1-i/8)*(isStunned()?.5:1);const r=s.r*(.6-i*.065),d=s.r*.6+i*s.r*.28;popOval(ctx,s.x-ux*d,s.y-uy*d,r,r*1.25,i>3?'#ffc9b7':i>1?'#ffd68e':'#fff2b7');}ctx.restore();
  }

  // 赤おに（画面の上。いんせきが出るたびに、ぴょんと はねて なげるまね）
  function drawOni() {
    if(nextId!==oniThrowId){oniThrowId=nextId;oniThrowUntil=clock+.3;}
    const bar=$('hud').getBoundingClientRect(),rect=app.getBoundingClientRect(),r=clamp(Math.min(W,H)*.075,25,42),sp=popSprite('oni',r,popOni);
    const throwing=clock<oniThrowUntil,hop=reduced()?0:throwing?Math.sin((oniThrowUntil-clock)/.3*Math.PI)*r*.2:Math.sin(clock*2.2)*r*.025;
    const x=W/2,y=bar.bottom-rect.top+r*1.1-hop;
    ctx.save();ctx.globalAlpha=.92;ctx.imageSmoothingEnabled=true;ctx.drawImage(sp.canvas,x-sp.size/2,y-sp.size/2,sp.size,sp.size);ctx.restore();
  }

  // ながれぼしのしっぽ
  function drawTrail(s) {
    const speed=Math.hypot(s.vx,s.vy)||1,alpha=isStunned()?.5:1;ctx.save();
    for(let i=6;i>0;i--){ctx.globalAlpha=(1-i/8)*alpha;popOval(ctx,s.x-s.vx/speed*i*9,s.y-s.vy/speed*i*9,s.r*(.4-i*.045),s.r*(.3-i*.03),i%2?'#fab7dc':'#fff');}ctx.restore();
  }

  function drawKumo(s) {
    const sp = sprites.kumo;
    // いなずまは ゆっくり光る（はげしい点滅はしない）
    const glow = reduced() ? 0.9 : 0.65 + 0.35 * Math.sin(clock * 3 + s.phase);
    drawBolt(ctx, s.x - s.r * 0.2, s.y + s.r * 0.35, s.r * 1.05, glow);
    ctx.drawImage(sp.canvas, s.x - sp.size / 2, s.y - sp.size / 2, sp.size, sp.size);
  }

  // しびれ中の表示
  function drawStun() {
    const left=clamp((stunUntil-elapsed)/CONFIG.STUN_TIME,0,1),w=224,h=74,x=(W-w)/2,y=Math.max(165,H*.25);ctx.save();
    roundRectPath(ctx,x,y,w,h,25);ctx.fillStyle='#ffffffed';ctx.fill();ctx.strokeStyle='#c3afd9';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#87749b';ctx.font='800 24px Meiryo,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('びりびり！',W/2,y+28);
    roundRectPath(ctx,x+18,y+54,w-36,8,4);ctx.fillStyle='#ece4f4';ctx.fill();roundRectPath(ctx,x+18,y+54,(w-36)*left,8,4);ctx.fillStyle='#c2a7e2';ctx.fill();ctx.restore();
  }

  function renderClear() {
    const t=sceneT,rm=reduced();
    // 単調にゆっくり明るくする。フラッシュ・画面の揺れは使わない。
    ctx.fillStyle='rgba(255,245,213,'+(rm?.12:clamp(t/2,0,1)*.18)+')';ctx.fillRect(0,0,W,H);
    const art=document.querySelector('.celebration-art').getBoundingClientRect();
    const appRect=app.getBoundingClientRect();
    const x=art.left-appRect.left+art.width/2,y=art.top-appRect.top,scale=Math.max(3,Math.min(6,Math.floor(art.height/40)));
    const opening=rm?1:clamp((t-.3)/.8,0,1);
    const radius=Math.min(W*.48,art.height*1.05);
    if(rm||t>.7)drawRainbow(ctx,x,y+art.height*.8,radius,radius*.08,rm?1:clamp((t-.7)/1,0,1),.85);
    renderParticles('confetti');
    renderParticles('foreground-effects');
    if(rm||t>.1)chest(ctx,x,y+art.height*.86,Math.min(scale,4),opening);
    // 取った星が飛んできて「75」になる（アニメーション軽減のときは、はじめから表示）
    const L=big75Layout();
    const done=flyers.length?renderFlyers(t,L):(rm||t>.65);
    if(done){
      for(let i=0;i<8;i++){const a=i*Math.PI/4+(rm?0:t*.25);sparkle(ctx,x+Math.cos(a)*art.width*.37,y+art.height*.5+Math.sin(a)*art.height*.4,6,i%2?'#fff5d5':'#f4b64d',.9);}
      outlinedPixelText(ctx,'75',L.x,L.yy,L.p,'#ffe18a');
    }
    const slot=slots.clear;
    if(slot&&(rm||t>1.4)){
      const a=rm?1:easeOutCubic(clamp((t-1.4)/1.1,0,1));
      drawAngel(ctx,slot.x,slot.y+(1-a)*(H-slot.y),slot.s*.85,clock,true);
    }
    drawGarden();
    const full=[...clearMessage()],count=rm?full.length:Math.floor(clamp(t/2.7,0,1)*full.length);
    const text=full.slice(0,count).join('');const target=$('clear-typed');
    if(target.textContent!==text)target.textContent=text;
  }

  function renderTimeup() {
    for (const d of decoStars) {
      ctx.drawImage(sprites.mini.canvas, d.x - sprites.mini.size / 2, d.y - sprites.mini.size / 2);
    }
    const slot = slots.timeup || { x: W / 2, y: H * 0.2, s: H * 0.2 };
    const at = clamp(sceneT / 0.8, 0, 1);
    const R = Math.min(W * 0.42, H * 0.3);
    drawRainbow(ctx, W / 2, slot.y + slot.s * 0.55, R, R * 0.08, 1, 0.55 * at);
    const e = reduced() ? 1 : easeOutCubic(at);
    ctx.save();
    ctx.globalAlpha = at;
    drawAngel(ctx, slot.x, slot.y + (1 - e) * 40 + (reduced() ? 0 : Math.sin(clock * 1.8) * slot.s * 0.04), slot.s * 0.85, clock, true);
    ctx.restore();
    drawGarden();
  }

  function renderParticles(only) {
    for(const p of particles){
      if(reduced()&&['confetti','ring','puff','glow'].includes(p.type))continue;
      if(only==='foreground-effects'?p.type==='confetti':only&&p.type!==only)continue;
      const k=clamp(p.life/p.max,0,1);ctx.save();
      if(p.type==='ring'){
        ctx.globalAlpha=(1-k)*(p.faint?.35:.75);ctx.strokeStyle=p.gold?'#ffd785':'#ffffff';ctx.lineWidth=3*(1-k)+1;ctx.beginPath();ctx.ellipse(p.x,p.y,p.r*(.6+k),p.r*(.45+k*.85),0,0,Math.PI*2);ctx.stroke();
        if(!p.faint&&k<.3&&!reduced()){const sp=p.gold?sprites.gold:sprites.normal,squash=Math.sin(k/.3*Math.PI)*.18;ctx.globalAlpha=(1-k/.3)*.65;ctx.translate(p.x,p.y);ctx.scale(1+squash,1-squash);ctx.drawImage(sp.canvas,-sp.size/2,-sp.size/2,sp.size,sp.size);}
      }else if(p.type==='spark'){
        sparkle(ctx,p.x,p.y,p.r*(1-k*.5),p.color,1-k);
      }else if(p.type==='text'){
        ctx.globalAlpha=k<.7?1:1-(k-.7)/.3;const size=p.size||Math.round(starR*(p.pts>=5?1.25:p.pts>=3?1.1:.9));
        if(p.text.startsWith('+'))outlinedPixelText(ctx,p.text,p.x,p.y,Math.max(3,Math.round(size/7)),'#ffffff');
        else{ctx.font='900 '+size+'px Meiryo,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=5;ctx.strokeStyle='#fff';ctx.strokeText(p.text,p.x,p.y);ctx.fillStyle=p.color||'#9b6ba5';ctx.fillText(p.text,p.x,p.y);}
      }else if(p.type==='note'){
        ctx.globalAlpha=k<.6?1:1-(k-.6)/.4;ctx.font='900 '+Math.max(18,starR*.7)+'px Meiryo,sans-serif';ctx.textAlign='center';ctx.fillStyle='#bc91b7';ctx.fillText('♪',p.x,p.y);
      }else if(p.type==='bloom'){
        const e=reduced()?1:easeOutBack(clamp(k/.25,0,1)),c=flowerSprite(2,1),w=9*p.scale*e;ctx.globalAlpha=k<.7?1:1-(k-.7)/.3;if(w>0)ctx.drawImage(c,0,0,c.width,c.height*.55,p.x-w/2,p.y-w/2,w,w*.8);
      }else if(p.type==='glow'){
        const e=easeOutCubic(k);sparkle(ctx,lerp(p.sx,p.tx,e),lerp(p.sy,p.ty,e)-Math.sin(e*Math.PI)*40,7,'#fff',1-k*.3);
      }else if(p.type==='puff'){
        ctx.globalAlpha=(1-k)*.5;popOval(ctx,p.x,p.y,p.r*(1+k*.8),p.r*.8*(1+k*.8),'#d0c9e4');
      }else if(p.type==='bolt')drawBolt(ctx,p.x,p.y,p.r,1-k);
      else if(p.type==='confetti'){
        ctx.globalAlpha=k>.85?1-(k-.85)/.15:1;ctx.translate(p.x,p.y);ctx.rotate(reduced()?0:p.rot);const r=p.r*.75;
        if(Math.floor(p.r)%3===0){popStarPath(ctx,0,0,r);ctx.fillStyle=p.color;ctx.fill();}
        else{popOval(ctx,0,0,r,r*(Math.floor(p.r)%2?.7:1.1),p.color);popOval(ctx,-r*.2,-r*.3,r*.25,r*.14,'#ffffffaa');}
      }ctx.restore();
    }
  }

  /* ---------------------------------------------------------
     ループ
     --------------------------------------------------------- */
  let lastTs = 0;
  function frame(ts) {
    // タブ切り替えなどで止まっていたぶんは進めない（最大0.05秒）
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    // 回転やアドレスバーの出入りで、resize の知らせが来ないまま大きさが変わることがあるので毎回確かめる
    if (app.clientWidth !== W || app.clientHeight !== H) resize();
    update(dt);
    Bgm.tick();
    render();
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------
     レベル
     --------------------------------------------------------- */
  function loadOni() {
    try { oniState = localStorage.getItem('ohoshi-oni') || ''; } catch (e) { oniState = ''; }
    if (DEBUG && params.has('oni')) oniState = oniState || '1';
    updateOniButton();
  }
  function saveOni(v) {
    oniState = v;
    try { localStorage.setItem('ohoshi-oni', v); } catch (e) { /* 保存できなくても遊べる */ }
    updateOniButton();
  }
  function updateOniButton() {
    const btn = document.querySelector('.lv-oni');
    btn.hidden = !oniState;
    screens.level.classList.toggle('oni-open', !!oniState);
    btn.querySelector('.lv-new').hidden = oniState !== '1';
  }
  function badgeHTML() {
    return '<span class="b-stars">' + '★'.repeat(level.stars) + '</span> ' + level.name;
  }

  function setLevel(key) {
    if (!LEVELS[key] || (key === 'oni' && !oniState)) key = 'easy';
    levelKey = key;
    level = LEVELS[key];
    try { localStorage.setItem('ohoshi-level', key); } catch (e) { /* 保存できなくても遊べる */ }
    buildSprites();
    document.querySelectorAll('.level-badge').forEach((el) => { el.innerHTML = badgeHTML(); el.classList.remove('oni-new'); });
    canvas.setAttribute('aria-label', key === 'oni' ? 'いんせきが おちてくる そら' : 'おほしさまが おちてくる そら');
    document.querySelector('.celebration-art').setAttribute('aria-label', key === 'oni' ? '75この いんせきと たからばこ' : '75この おほしさまと たからばこ');
  }

  function showLevelScreen() {
    clearLater();
    state = 'level';
    sceneT = 0;
    stars.length = 0;
    showScreen('level');
    const btn = document.querySelector('.level-btn[data-level="' + levelKey + '"]');
    if (btn) btn.focus({ preventScroll: true });
  }

  // おにチャレンジの説明画面。「スタート！」を押すまで時間は動かない
  function showOniIntro() {
    clearLater();
    state = 'intro';
    sceneT = 0;
    stars.length = 0;
    particles.length = 0;
    showScreen('intro');
    screens.intro.querySelectorAll('canvas[data-meteor]').forEach((el) => {
      const g = el.getContext('2d');
      g.clearRect(0, 0, el.width, el.height);
      const sp=makeMeteorSprite(25,el.dataset.meteor);g.drawImage(sp.canvas,0,0,el.width,el.height);
    });
    $('oni-go').focus({ preventScroll: true });
  }

  // レベルえらびの「おにチャレンジ」ボタンの絵
  function drawOniIcon() {
    const el=document.querySelector('.lv-oni canvas'),g=el.getContext('2d'),sp=popSprite('oni-icon',20,popOni);g.clearRect(0,0,el.width,el.height);g.imageSmoothingEnabled=true;g.drawImage(sp.canvas,0,0,el.width,el.height);
  }

  function showTitle() {
    clearLater();
    state = 'title';
    sceneT = 0;
    showScreen('title');
  }

  /* ---------------------------------------------------------
     初期化
     --------------------------------------------------------- */
  function init() {
    canvas.tabIndex = 0;
    let saved = null;
    try { saved = localStorage.getItem('ohoshi-level'); } catch (e) { /* 使えない環境でも遊べる */ }
    const first = (DEBUG && params.get('level')) || saved;
    if (LEVELS[first]) { levelKey = first; level = LEVELS[first]; }
    loadOni();
    if (levelKey === 'oni' && !oniState) { levelKey = 'easy'; level = LEVELS.easy; }
    resize();
    setLevel(levelKey);
    loadGarden();
    drawOniIcon();
    window.addEventListener('resize', () => { resize(); render(); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { resize(); render(); });
    window.addEventListener('orientationchange', () => setTimeout(() => { resize(); render(); }, 300));

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    // スクロール・ピンチ・長押しを防ぐ
    const stop = (e) => e.preventDefault();
    document.addEventListener('touchmove', stop, { passive: false });
    document.addEventListener('gesturestart', stop);
    document.addEventListener('dblclick', stop);
    canvas.addEventListener('contextmenu', stop);
    document.addEventListener('visibilitychange', () => { lastTs = 0; });

    $('start-btn').addEventListener('click', showLevelScreen);
    $('level-back').addEventListener('click', showTitle);
    document.querySelectorAll('.level-btn').forEach((b) => b.addEventListener('click', () => {
      setLevel(b.dataset.level);
      if (levelKey === 'oni') showOniIntro(); else startGame();
    }));
    $('oni-go').addEventListener('click', startGame);
    document.querySelectorAll('.change-level').forEach((b) => b.addEventListener('click', () => {
      if (b.classList.contains('to-oni')) { setLevel('oni'); showOniIntro(); } else showLevelScreen();
    }));
    $('retry-clear').addEventListener('click', startGame);
    $('retry-timeup').addEventListener('click', startGame);
    soundBtn.addEventListener('click', toggleSound);
    if (Vibe.supported) {
      vibeBtn.hidden = false;
      vibeBtn.addEventListener('click', toggleVibe);
    }

    showScreen('title');
    requestAnimationFrame(frame);

    if (DEBUG) {
      // テスト用（URLに ?debug を付けたときだけ）
      window.__ohoshi = {
        CONFIG,
        get state() { return state; },
        get score() { return score; },
        get elapsed() { return elapsed; },
        get stars() { return stars; },
        get sound() { return Sound.enabled; },
        get stunned() { return isStunned(); },
        get size() { return [W, H]; },
        get caught() { return caughtLog.length; },
        get flyers() { return flyers; },
        get cheerText() { return clock < cheer.until ? cheer.text : ''; },
        get rainbow() { return rainbowShown; },
        get melodyIndex() { return Sound.melodyIndex; },
        get garden() { return gardenCount; },
        get combo() { return combo.count; },
        get bands() { return bandsDone; },
        get oni() { return oniState; },
        unlockOni() { saveOni('1'); },
        resetOni() { saveOni(''); },
        get vibe() { return { supported: Vibe.supported, enabled: Vibe.enabled, log: Vibe.log }; },
        get bgm() { return { on: !!Bgm.out, song: Bgm.song && Bgm.song.bpm, step: Bgm.step, audio: Sound.ctx ? Sound.ctx.state : 'none' }; },
        bgmTick() { Bgm.tick(); },
        get audio() { return Sound; },
        get flowerSpot() { return flowerShowSpot(); },
        render,
        get level() { return levelKey; },
        setLevel,
        step(sec, fps = 60) {
          const n = Math.round(sec * fps);
          for (let i = 0; i < n; i++) update(1 / fps);
          render();
        },
        start: startGame,
        catchStar,
        tapAt(x, y) {
          onPointerDown({ clientX: x + canvas.getBoundingClientRect().left, clientY: y + canvas.getBoundingClientRect().top, preventDefault() {} });
        },
        spawn: spawnStar,
      };
    }
  }

  init();
})();
