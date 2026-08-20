(() => {
  'use strict';

  // ============ EVENT INFO (edit here if needed) ============
  const EVENT = {
    eyebrow: "YOU'RE INVITED",
    brand: 'O-O POLAROID',
    tagline: 'OPENING DAY ✨',
    forLabel: 'For',
    time: '4:00 PM',
    date: 'Sep 11, 2026',
    address: '161/4 Nguyen Van Thu St., Tan Dinh, HCMC',
    footer: 'See you soon 💛',
  };

  const CHAT_LINES = [
    'Hiiiii',
    '11/9 này có rảnh khong',
    'Nếu rảnh thì nhập tên vào nhaa',
  ];

  // ============ DOM ============
  const chatBody = document.getElementById('chatBody');
  const nameForm = document.getElementById('nameForm');
  const nameInput = document.getElementById('nameInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatScreen = document.getElementById('chatScreen');
  const cardOverlay = document.getElementById('cardOverlay');
  const cardDateLabel = document.getElementById('cardDateLabel');
  const canvas = document.getElementById('inviteCanvas');
  const ctx = canvas.getContext('2d');
  const saveImageBtn = document.getElementById('saveImageBtn');
  const saveVideoBtn = document.getElementById('saveVideoBtn');
  const videoProgress = document.getElementById('videoProgress');
  const resetBtn = document.getElementById('resetBtn');
  const closeBtn = document.getElementById('closeBtn');

  cardDateLabel.textContent = EVENT.date;

  // ============ helpers ============
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const progressBetween = (t, a, b) => clamp01((t - a) / (b - a));
  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
  const easeOutBack = (x) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };

  function addBubble(text, dir) {
    const row = document.createElement('div');
    row.className = `bubble-row ${dir}`;
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    row.appendChild(b);
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
    return row;
  }

  function addTyping() {
    const row = document.createElement('div');
    row.className = 'bubble-row in';
    row.innerHTML = '<div class="typing-bubble"><span></span><span></span><span></span></div>';
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
    return row;
  }

  async function playIncoming(text) {
    const typing = addTyping();
    await wait(650 + Math.random() * 400);
    typing.remove();
    addBubble(text, 'in');
    await wait(250);
  }

  async function runChatIntro() {
    chatBody.innerHTML = '';
    nameForm.hidden = true;
    for (const line of CHAT_LINES) {
      await playIncoming(line);
    }
    nameForm.hidden = false;
    nameInput.value = '';
    nameInput.focus();
  }

  // ============ assets preload ============
  const logoImg = new Image();
  const logoReady = new Promise((resolve) => {
    logoImg.onload = resolve;
    logoImg.onerror = resolve;
  });
  logoImg.src = 'assets/logo.png';

  const fontsReady = Promise.all([
    document.fonts.load('400 40px Outfit'),
    document.fonts.load('600 40px Outfit'),
    document.fonts.load('700 40px Outfit'),
    document.fonts.load('800 40px Outfit'),
  ]).catch(() => {});

  const assetsReady = Promise.all([logoReady, fontsReady]);

  // ============ canvas drawing ============
  const W = canvas.width, H = canvas.height;
  const PASTEL_BLUE = '#C1DBE8';
  const CARD_RED = '#7C2A2B';
  const CARD_BEIGE = '#E8D9BB';
  const CREAM = '#FFFDF6';
  const PALETTE = [CARD_BEIGE, PASTEL_BLUE, CREAM];

  function makeConfetti(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: 60 + Math.random() * (W - 120),
        y: -40 - Math.random() * 500,
        size: 8 + Math.random() * 14,
        speed: 90 + Math.random() * 140,
        drift: (Math.random() - 0.5) * 40,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 3,
        color: PALETTE[(Math.random() * PALETTE.length) | 0],
        shape: ['circle', 'rect', 'triangle'][(Math.random() * 3) | 0],
      });
    }
    return arr;
  }
  let confetti = makeConfetti(46);

  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawConfettiPiece(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.85;
    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'rect') {
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -p.size / 2);
      ctx.lineTo(p.size / 2, p.size / 2);
      ctx.lineTo(-p.size / 2, p.size / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function wrapLines(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawStar(cx, cy, r, color, alpha, rot) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(rot || 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    const spikes = 6;
    for (let i = 0; i < spikes; i++) {
      const a = (Math.PI * 2 * i) / spikes;
      const len = r * (0.82 + (i % 2 === 0 ? 0.18 : 0));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  const CARD = { x: 46, y: 46, w: W - 92, h: H - 92, r: 46 };

  function drawBase() {
    // outer background
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, W, H);

    // card — solid red, no gradient
    ctx.save();
    roundRectPath(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
    ctx.fillStyle = CARD_RED;
    ctx.fill();
    ctx.restore();
  }

  function drawContent(t, { confettiOn }) {
    ctx.save();
    roundRectPath(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
    ctx.clip();

    // soft dot texture (paper grain)
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = CARD_BEIGE;
    for (let i = 0; i < 60; i++) {
      const seedX = (i * 137.5) % CARD.w;
      const seedY = (i * 89.3) % CARD.h;
      ctx.beginPath();
      ctx.arc(CARD.x + seedX, CARD.y + seedY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // dashed border frame
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = PASTEL_BLUE;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.setLineDash([4, 22]);
    roundRectPath(ctx, CARD.x + 26, CARD.y + 26, CARD.w - 52, CARD.h - 52, CARD.r - 16);
    ctx.stroke();
    ctx.restore();

    // corner star doodles
    drawStar(CARD.x + 70, CARD.y + 66, 28, PASTEL_BLUE, 0.95, -0.2);
    drawStar(CARD.x + CARD.w - 66, CARD.y + CARD.h - 74, 24, PASTEL_BLUE, 0.95, 0.4);

    if (confettiOn) {
      for (const p of confetti) drawConfettiPiece(p);
    }

    const cx = W / 2;

    // eyebrow label
    const p0 = progressBetween(t, 0.0, 0.18);
    if (p0 > 0) {
      ctx.save();
      ctx.globalAlpha = easeOutCubic(p0);
      ctx.translate(0, (1 - easeOutCubic(p0)) * -16);
      ctx.font = '700 26px Outfit, sans-serif';
      ctx.fillStyle = CARD_BEIGE;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(EVENT.eyebrow, cx, CARD.y + 90);
      ctx.restore();
    }

    // logo sticker (bounce)
    const p1 = progressBetween(t, 0.08, 0.34);
    if (p1 > 0) {
      const scale = 0.4 + 0.6 * easeOutBack(p1);
      const r = 92;
      ctx.save();
      ctx.globalAlpha = clamp01(p1 * 2);
      ctx.translate(cx, CARD.y + 210);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = CREAM;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      if (logoImg.complete && logoImg.naturalWidth) {
        const pad = 26;
        const iw = r * 2 - pad * 2;
        const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
        let dw = iw, dh = iw / ratio;
        if (dh > iw) { dh = iw; dw = iw * ratio; }
        ctx.drawImage(logoImg, -dw / 2, -dh / 2, dw, dh);
      }
      ctx.restore();
    }

    // brand title
    const p2 = progressBetween(t, 0.24, 0.44);
    if (p2 > 0) {
      ctx.save();
      ctx.globalAlpha = easeOutCubic(p2);
      ctx.translate(0, (1 - easeOutCubic(p2)) * 18);
      ctx.font = '800 58px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CARD_BEIGE;
      ctx.fillText(EVENT.brand, cx, CARD.y + 372);
      ctx.font = '600 28px Outfit, sans-serif';
      ctx.fillStyle = PASTEL_BLUE;
      ctx.fillText(EVENT.tagline, cx, CARD.y + 424);
      ctx.restore();
    }

    // name
    const p3 = progressBetween(t, 0.42, 0.6);
    if (p3 > 0) {
      ctx.save();
      ctx.globalAlpha = easeOutCubic(p3);
      ctx.translate(0, (1 - easeOutCubic(p3)) * 16);
      ctx.font = '600 24px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(232,217,187,0.75)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(EVENT.forLabel, cx, CARD.y + 500);

      let displayName = window.__inviteName || 'you';
      ctx.font = '800 52px Outfit, sans-serif';
      let nameWidth = ctx.measureText(displayName).width;
      const maxNameWidth = CARD.w - 100;
      let fontSize = 52;
      while (nameWidth > maxNameWidth && fontSize > 28) {
        fontSize -= 2;
        ctx.font = `800 ${fontSize}px Outfit, sans-serif`;
        nameWidth = ctx.measureText(displayName).width;
      }
      ctx.fillStyle = CARD_BEIGE;
      ctx.fillText(`${displayName} 💕`, cx, CARD.y + 555);
      ctx.restore();
    }

    // date/time
    const p4 = progressBetween(t, 0.58, 0.74);
    if (p4 > 0) {
      const alpha = easeOutCubic(p4);
      const ty = (1 - alpha) * 14;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(0, ty);
      ctx.font = '700 30px Outfit, sans-serif';
      ctx.fillStyle = CARD_BEIGE;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🕓  ${EVENT.time}   ·   ${EVENT.date}`, cx, CARD.y + 668);
      ctx.restore();
    }

    // address
    const p5 = progressBetween(t, 0.7, 0.88);
    if (p5 > 0) {
      const alpha = easeOutCubic(p5);
      const ty = (1 - alpha) * 14;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(0, ty);
      ctx.font = '700 26px Outfit, sans-serif';
      ctx.fillStyle = CARD_BEIGE;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxTextWidth = CARD.w - 180;
      const lines = wrapLines('📍 ' + EVENT.address, maxTextWidth);
      const lineH = 38;
      const startY = CARD.y + 748 - ((lines.length - 1) * lineH) / 2;
      lines.forEach((line, i) => {
        ctx.fillText(line, cx, startY + i * lineH);
      });
      ctx.restore();
    }

    // footer note
    const p6 = progressBetween(t, 0.86, 1.0);
    if (p6 > 0) {
      ctx.save();
      ctx.globalAlpha = easeOutCubic(p6);
      ctx.font = '600 24px Outfit, sans-serif';
      ctx.fillStyle = PASTEL_BLUE;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(EVENT.footer, cx, CARD.y + CARD.h - 56);
      ctx.restore();
    }

    ctx.restore(); // clip
  }

  function stepConfetti(dt) {
    for (const p of confetti) {
      p.y += p.speed * dt;
      p.x += p.drift * dt;
      p.rot += p.rotSpeed * dt;
      if (p.y > CARD.y + CARD.h + 40) {
        p.y = CARD.y - 40 - Math.random() * 120;
        p.x = 60 + Math.random() * (W - 120);
      }
    }
  }

  const REVEAL_MS = 3800;

  function playReveal({ record = false } = {}) {
    return new Promise((resolve) => {
      let recorder = null;
      let chunks = [];
      let mimeType = '';

      if (record) {
        const candidates = [
          'video/mp4;codecs=h264',
          'video/mp4',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
        ];
        mimeType = candidates.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
        try {
          const stream = canvas.captureStream(30);
          recorder = mimeType
            ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
            : new MediaRecorder(stream);
          recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
          recorder.start();
        } catch (err) {
          recorder = null;
        }
      }

      confetti = makeConfetti(46);
      let start = null;
      let lastT = 0;

      function frame(now) {
        if (start === null) start = now;
        const elapsed = now - start;
        const dt = Math.min(0.05, (elapsed - lastT) / 1000);
        lastT = elapsed;
        const t = clamp01(elapsed / REVEAL_MS);

        drawBase();
        stepConfetti(dt);
        drawContent(t, { confettiOn: t < 1 });

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          drawBase();
          drawContent(1, { confettiOn: false });
          if (recorder) {
            setTimeout(() => {
              recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
                resolve({ blob, mimeType: mimeType || 'video/webm' });
              };
              recorder.stop();
            }, 350);
          } else {
            resolve({});
          }
        }
      }
      requestAnimationFrame(frame);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function safeFileSlug(name) {
    return (name || 'you')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'you';
  }

  // ============ flow control ============
  async function openCardModal(name) {
    window.__inviteName = name;
    chatScreen.classList.add('is-dimmed');
    cardOverlay.hidden = false;
    saveImageBtn.disabled = true;
    saveVideoBtn.disabled = true;
    await assetsReady;
    await playReveal({ record: false });
    saveImageBtn.disabled = false;
    saveVideoBtn.disabled = false;
  }

  function closeCardModal() {
    cardOverlay.hidden = true;
    chatScreen.classList.remove('is-dimmed');
  }

  nameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    sendBtn.disabled = true;
    nameForm.hidden = true;
    addBubble(name, 'out');
    await wait(300);
    await playIncoming(`Yeii 🎉 đợi xíu, thiệp của ${name} nè~`);
    await wait(700);
    sendBtn.disabled = false;
    openCardModal(name);
  });

  saveImageBtn.addEventListener('click', () => {
    if (saveImageBtn.disabled) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `OO-Polaroid-Invite-${safeFileSlug(window.__inviteName)}.png`);
    }, 'image/png');
  });

  saveVideoBtn.addEventListener('click', async () => {
    if (saveVideoBtn.disabled) return;
    saveVideoBtn.disabled = true;
    saveImageBtn.disabled = true;
    videoProgress.hidden = false;
    videoProgress.textContent = 'Recording...';

    const { blob, mimeType } = await playReveal({ record: true });

    if (blob && blob.size) {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(blob, `OO-Polaroid-Invite-${safeFileSlug(window.__inviteName)}.${ext}`);
      videoProgress.textContent = 'Saved! 🎉';
    } else {
      videoProgress.textContent = "Can't record here — try Save Image instead.";
    }
    saveVideoBtn.disabled = false;
    saveImageBtn.disabled = false;
    setTimeout(() => { videoProgress.hidden = true; }, 3200);
  });

  resetBtn.addEventListener('click', () => {
    closeCardModal();
    runChatIntro();
  });

  closeBtn.addEventListener('click', () => {
    closeCardModal();
  });

  // ============ init ============
  drawBase();
  runChatIntro();
})();
