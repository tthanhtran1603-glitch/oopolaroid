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
  const liveCanvas = document.getElementById('inviteCanvas');
  // `canvas`/`ctx` are swapped to an offscreen 9:16 canvas while exporting a
  // save (see layoutExportCanvas) so the on-screen popup can stay whatever
  // shape the viewer's device is, while the saved file is always a story.
  let canvas = liveCanvas;
  let ctx = liveCanvas.getContext('2d');
  const saveImageBtn = document.getElementById('saveImageBtn');
  const saveVideoBtn = document.getElementById('saveVideoBtn');
  const videoProgress = document.getElementById('videoProgress');
  const resetBtn = document.getElementById('resetBtn');
  const closeBtn = document.getElementById('closeBtn');
  const saveVideoLabel = document.getElementById('saveVideoLabel');

  // ============ helpers ============
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const progressBetween = (t, a, b) => clamp01((t - a) / (b - a));
  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

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

  const cameraImg = new Image();
  const cameraReady = new Promise((resolve) => {
    cameraImg.onload = resolve;
    cameraImg.onerror = resolve;
  });
  cameraImg.src = 'assets/camera.jpg';

  const fontsReady = Promise.all([
    document.fonts.load('400 40px Outfit'),
    document.fonts.load('600 40px Outfit'),
    document.fonts.load('700 40px Outfit'),
    document.fonts.load('800 40px Outfit'),
  ]).catch(() => {});

  const assetsReady = Promise.all([logoReady, cameraReady, fontsReady]);

  // ============ canvas drawing ============
  const PASTEL_BLUE = '#C1DBE8';
  const CARD_RED = '#7C2A2B';
  const CARD_BEIGE = '#E8D9BB';
  const CREAM = '#FFFDF6';

  // single polaroid geometry — real 107 x 88mm format, 79 x 77mm image area
  const MM_W = 88, MM_H = 107, IMG_MM_W = 79, IMG_MM_H = 77;

  let W = 0, H = 0, DPR = 1;
  let POLA, PHOTO, CAPTION, CAMERA;

  // 9:16 — every saved image/video is this size regardless of the viewer's
  // own screen shape, so it drops straight into an Instagram/FB story.
  const EXPORT_W = 1080, EXPORT_H = 1920;

  function computeLayout(bottomReserve) {
    // sized off the shorter side so the camera looks right whether this is
    // a tall phone popup, a wide desktop popup, or the fixed 9:16 export
    const shortSide = Math.min(W, H);
    // small — a supporting detail, not competing with the polaroid card
    const camW = clamp01Range(shortSide * 0.22, 110, 190);
    const camH = camW * (700 / 600); // matches the source camera photo's proportions
    CAMERA = {
      w: camW,
      h: camH,
      x: (W - camW) / 2,
      y: Math.max(26, H * 0.04),
    };
    CAMERA.slotY = CAMERA.y + CAMERA.h;

    const topMargin = CAMERA.slotY + Math.max(16, H * 0.02);
    const sideMargin = Math.max(20, W * 0.06);
    const availW = W - sideMargin * 2;
    const availH = H - topMargin - bottomReserve;
    const ratio = MM_H / MM_W;
    let polaW = availW;
    let polaH = polaW * ratio;
    if (polaH > availH) {
      polaH = Math.max(availH, 200);
      polaW = polaH / ratio;
    }

    POLA = { w: polaW, h: polaH };
    POLA.x = (W - polaW) / 2;
    POLA.y = topMargin;

    const mmToPx = POLA.w / MM_W;
    const pad = Math.round(((MM_W - IMG_MM_W) / 2) * mmToPx);
    const capH = POLA.h - pad - Math.round(IMG_MM_H * mmToPx);
    PHOTO = {
      x: POLA.x + pad,
      y: POLA.y + pad,
      w: POLA.w - pad * 2,
      h: POLA.h - pad - capH,
    };
    CAPTION = { x: POLA.x, y: PHOTO.y + PHOTO.h, w: POLA.w, h: capH };
  }

  function clamp01Range(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function layoutCanvas() {
    canvas = liveCanvas;
    ctx = liveCanvas.getContext('2d');
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    computeLayout(148); // reserve room for the fixed bottom action bar
  }

  // Resizing a canvas (even to the same dimensions) clears its pixels, so
  // switching back from the export canvas needs a repaint, not just a
  // layout call, or the popup goes blank.
  function restoreLiveCanvas() {
    layoutCanvas();
    drawBase();
    drawContent(1);
  }

  // Points the shared drawing state at a detached, invisible canvas for
  // export — same drawBase/drawContent code, fixed 9:16 frame, no button
  // bar to leave room for. Call layoutCanvas() again afterwards to restore
  // the live popup.
  function layoutExportCanvas() {
    const target = document.createElement('canvas');
    canvas = target;
    ctx = target.getContext('2d');
    DPR = 1;
    W = EXPORT_W;
    H = EXPORT_H;
    target.width = W;
    target.height = H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    computeLayout(0);
    return target;
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

  function drawBase() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, W, H);
  }

  function drawCamera(alpha) {
    const { x, y, w, h } = CAMERA;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;
    roundRectPath(ctx, x, y, w, h, 20);
    ctx.fillStyle = CREAM;
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.save();
    roundRectPath(ctx, x, y, w, h, 20);
    ctx.clip();
    if (cameraImg.complete && cameraImg.naturalWidth) {
      const imgRatio = cameraImg.naturalWidth / cameraImg.naturalHeight;
      const boxRatio = w / h;
      let dw, dh;
      if (imgRatio > boxRatio) { dh = h; dw = h * imgRatio; } else { dw = w; dh = w / imgRatio; }
      ctx.drawImage(cameraImg, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    }
    ctx.restore();
    ctx.restore();
  }

  function drawFlash(t) {
    const flashA = Math.max(0, 1 - t / 0.07);
    if (flashA <= 0) return;
    ctx.save();
    ctx.globalAlpha = flashA * 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawTape(cx, cy, w, h, rot, color, pattern) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#2A2018';
    if (pattern === 'stripe') {
      for (let i = -w / 2 + 6; i < w / 2; i += 14) {
        ctx.fillRect(i, -h / 2, 4, h);
      }
    } else if (pattern === 'dot') {
      for (let i = -w / 2 + 10; i < w / 2; i += 18) {
        ctx.beginPath();
        ctx.arc(i, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawContent(t) {
    const cx = W / 2;

    // camera pops in first
    const pCam = progressBetween(t, 0.0, 0.06);
    if (pCam > 0) drawCamera(easeOutCubic(pCam));

    // polaroid slides out from the camera's slot
    const pEject = progressBetween(t, 0.04, 0.2);
    if (pEject <= 0) { drawFlash(t); return; }
    const eject = easeOutCubic(pEject);
    const startY = CAMERA.slotY - POLA.h + 22;
    const curY = startY + (POLA.y - startY) * eject;
    const dy = curY - POLA.y;

    ctx.save();
    ctx.translate(0, dy);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 18;
    roundRectPath(ctx, POLA.x, POLA.y, POLA.w, POLA.h, 20);
    ctx.fillStyle = CREAM;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    roundRectPath(ctx, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, 8);
    ctx.fillStyle = CARD_RED;
    ctx.fill();
    ctx.restore();

    // camera sits on top, hiding whatever hasn't emerged yet
    if (pCam > 0) drawCamera(easeOutCubic(pCam));

    // washi tape across two corners, once the photo is mostly out
    const pTape = progressBetween(t, 0.17, 0.25);
    if (pTape > 0) {
      ctx.save();
      ctx.globalAlpha = easeOutCubic(pTape);
      drawTape(POLA.x + 26, POLA.y + 8, POLA.w * 0.15, POLA.w * 0.055, -0.5, PASTEL_BLUE, 'stripe');
      drawTape(POLA.x + POLA.w - 24, POLA.y + POLA.h * 0.32, POLA.w * 0.14, POLA.w * 0.05, 0.48, CARD_BEIGE, 'dot');
      ctx.restore();
    }

    // content clipped to the red photo window
    // S scales every tuned pixel value below against the 720px-wide design
    // reference, so the layout holds together at any viewport size.
    const S = POLA.w / 720;
    ctx.save();
    roundRectPath(ctx, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, 8);
    ctx.clip();

    // soft dot texture (paper grain)
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = CARD_BEIGE;
    for (let i = 0; i < 70; i++) {
      const seedX = (i * 137.5) % PHOTO.w;
      const seedY = (i * 89.3) % PHOTO.h;
      ctx.beginPath();
      ctx.arc(PHOTO.x + seedX, PHOTO.y + seedY, 2.2 * S, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Every piece of info develops together, like a Polaroid photo: it all
    // fades in from a heavy blur to sharp at once, instead of one line at
    // a time.
    const pInfo = progressBetween(t, 0.26, 0.94);
    const infoEase = easeOutCubic(pInfo);
    const infoBlur = (1 - infoEase) * 16 * S;
    ctx.globalAlpha = infoEase;
    ctx.filter = infoBlur > 0.3 ? `blur(${infoBlur}px)` : 'none';

    if (pInfo > 0) {
      // eyebrow label
      ctx.font = `700 ${21 * S}px Outfit, sans-serif`;
      ctx.fillStyle = CARD_BEIGE;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(EVENT.eyebrow, cx, PHOTO.y + 46 * S);

      // logo sticker
      const r = 58 * S;
      ctx.save();
      ctx.translate(cx, PHOTO.y + 132 * S);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = CREAM;
      ctx.fill();
      if (logoImg.complete && logoImg.naturalWidth) {
        const pad = 18 * S;
        const iw = r * 2 - pad * 2;
        const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
        let dw = iw, dh = iw / ratio;
        if (dh > iw) { dh = iw; dw = iw * ratio; }
        ctx.drawImage(logoImg, -dw / 2, -dh / 2, dw, dh);
      }
      ctx.restore();

      // brand title
      ctx.font = `800 ${38 * S}px Outfit, sans-serif`;
      ctx.fillStyle = CARD_BEIGE;
      ctx.fillText(EVENT.brand, cx, PHOTO.y + 244 * S);
      ctx.font = `600 ${19 * S}px Outfit, sans-serif`;
      ctx.fillStyle = PASTEL_BLUE;
      ctx.fillText(EVENT.tagline, cx, PHOTO.y + 280 * S);

      // name
      ctx.font = `600 ${19 * S}px Outfit, sans-serif`;
      ctx.fillStyle = 'rgba(232,217,187,0.75)';
      ctx.fillText(EVENT.forLabel, cx, PHOTO.y + 352 * S);

      let displayName = window.__inviteName || 'you';
      let fontSize = 38 * S;
      ctx.font = `800 ${fontSize}px Outfit, sans-serif`;
      let nameWidth = ctx.measureText(displayName).width;
      const maxNameWidth = PHOTO.w - 56 * S;
      const minFontSize = 22 * S;
      while (nameWidth > maxNameWidth && fontSize > minFontSize) {
        fontSize -= 2 * S;
        ctx.font = `800 ${fontSize}px Outfit, sans-serif`;
        nameWidth = ctx.measureText(displayName).width;
      }
      ctx.fillStyle = CARD_BEIGE;
      ctx.fillText(displayName, cx, PHOTO.y + 396 * S);

      // date/time
      ctx.font = `700 ${21 * S}px Outfit, sans-serif`;
      ctx.fillText(`🕓  ${EVENT.time}   ·   ${EVENT.date}`, cx, PHOTO.y + 478 * S);

      // address
      ctx.font = `700 ${17 * S}px Outfit, sans-serif`;
      const maxTextWidth = PHOTO.w - 60 * S;
      const lines = wrapLines('📍 ' + EVENT.address, maxTextWidth);
      const lineH = 24 * S;
      const startY = PHOTO.y + 540 * S;
      lines.forEach((line, i) => {
        ctx.fillText(line, cx, startY + i * lineH);
      });
    }

    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.restore(); // photo window clip

    // caption strip (note under the photo) — develops in step with the rest
    if (pInfo > 0) {
      ctx.save();
      ctx.globalAlpha = infoEase;
      ctx.filter = infoBlur > 0.3 ? `blur(${infoBlur}px)` : 'none';
      ctx.font = `600 ${28 * S}px Outfit, sans-serif`;
      ctx.fillStyle = CARD_RED;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(EVENT.footer, CAPTION.x + CAPTION.w / 2, CAPTION.y + CAPTION.h / 2);
      ctx.restore();
    }

    drawFlash(t);
  }

  const REVEAL_MS = 7400;

  // drives the on-screen popup reveal (whatever shape the viewer's canvas
  // currently is — always the live canvas, never the export one)
  function playReveal() {
    return new Promise((resolve) => {
      let start = null;
      function frame(now) {
        if (start === null) start = now;
        const t = clamp01((now - start) / REVEAL_MS);
        drawBase();
        drawContent(t);
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          drawBase();
          drawContent(1);
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  const EXPORT_MIME_CANDIDATES = [
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  // replays the whole reveal a second time on an invisible 9:16 canvas so
  // the saved video is always story-shaped, independent of the popup
  function playExportReveal() {
    return new Promise((resolve) => {
      const target = layoutExportCanvas();

      let recorder = null;
      let chunks = [];
      let mimeType = EXPORT_MIME_CANDIDATES.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
      try {
        const stream = target.captureStream(30);
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
          : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        recorder.start();
      } catch (err) {
        recorder = null;
      }

      if (!recorder) {
        restoreLiveCanvas();
        resolve({});
        return;
      }

      let start = null;
      function frame(now) {
        if (start === null) start = now;
        const t = clamp01((now - start) / REVEAL_MS);
        drawBase();
        drawContent(t);
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          drawBase();
          drawContent(1);
          setTimeout(() => {
            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
              restoreLiveCanvas();
              resolve({ blob, mimeType: mimeType || 'video/webm' });
            };
            recorder.stop();
          }, 350);
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

  // Prefers the native share sheet (reliable "Save to Photos/Files" on
  // mobile, where a plain <a download> blob link is often silently ignored)
  // and falls back to a direct download link everywhere else.
  async function saveBlob(blob, filename, mimeType) {
    try {
      if (navigator.canShare && navigator.share) {
        const file = new File([blob], filename, { type: mimeType });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return;
        }
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user dismissed the sheet
    }
    downloadBlob(blob, filename);
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
  let modalOpen = false;

  async function openCardModal(name) {
    window.__inviteName = name;
    chatScreen.classList.add('is-dimmed');
    cardOverlay.hidden = false;
    modalOpen = true;
    layoutCanvas();
    saveImageBtn.disabled = true;
    saveVideoBtn.disabled = true;
    await assetsReady;
    await playReveal();
    saveImageBtn.disabled = false;
    saveVideoBtn.disabled = false;
  }

  function closeCardModal() {
    cardOverlay.hidden = true;
    modalOpen = false;
    chatScreen.classList.remove('is-dimmed');
    pendingVideo = null;
    saveVideoLabel.textContent = 'Save Video';
    videoProgress.hidden = true;
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!modalOpen) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(restoreLiveCanvas, 150);
  });

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
    // render the settled frame onto the hidden 9:16 canvas so the saved
    // image is story-shaped, not whatever shape the popup happens to be
    const target = layoutExportCanvas();
    drawBase();
    drawContent(1);
    target.toBlob((blob) => {
      restoreLiveCanvas();
      if (!blob) return;
      saveBlob(blob, `OO-Polaroid-Invite-${safeFileSlug(window.__inviteName)}.png`, 'image/png');
    }, 'image/png');
  });

  // Recording needs the reveal to replay in full (~5s), and by the time it's
  // done the original click's "user activation" has expired in most
  // browsers — calling the share sheet after that async wait fails silently
  // on mobile. So step 1 just records, and step 2 (a fresh tap) does the
  // actual save/share, keeping it inside a real user gesture.
  let pendingVideo = null;

  saveVideoBtn.addEventListener('click', async () => {
    if (saveVideoBtn.disabled) return;

    if (pendingVideo) {
      const { blob, mimeType } = pendingVideo;
      pendingVideo = null;
      saveVideoLabel.textContent = 'Save Video';
      videoProgress.hidden = false;
      videoProgress.textContent = 'Saving...';
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      await saveBlob(blob, `OO-Polaroid-Invite-${safeFileSlug(window.__inviteName)}.${ext}`, mimeType);
      videoProgress.textContent = 'Saved! 🎉';
      setTimeout(() => { videoProgress.hidden = true; }, 2200);
      return;
    }

    saveVideoBtn.disabled = true;
    saveImageBtn.disabled = true;
    videoProgress.hidden = false;
    videoProgress.textContent = 'Recording...';

    const { blob, mimeType } = await playExportReveal();

    if (blob && blob.size) {
      pendingVideo = { blob, mimeType };
      saveVideoLabel.textContent = 'Tap to Save 👆';
      videoProgress.textContent = 'Video ready!';
      saveVideoBtn.disabled = false;
    } else {
      videoProgress.textContent = "Can't record here — try Save Image instead.";
      setTimeout(() => { videoProgress.hidden = true; }, 3200);
    }
    saveImageBtn.disabled = false;
  });

  resetBtn.addEventListener('click', () => {
    closeCardModal();
    runChatIntro();
  });

  closeBtn.addEventListener('click', () => {
    closeCardModal();
  });

  // ============ init ============
  runChatIntro();
})();
