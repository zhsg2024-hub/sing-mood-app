/**
 * 哼歌助手 - 主应用逻辑
 */
(() => {
  // 全局配置（可选接入第三方 API）
  window.APP_CONFIG = {
    // apiBaseUrl: "https://your-server.onrender.com",
    // apiSecret: "与服务器 API_SECRET 一致（可选）",
    // auddToken: "...",  // 若接入 AudD，建议也放服务端
  };

  ApiClient.migrateLegacyKeys();

  // --- 状态 ---
  const state = {
    currentSong: null,
    matchResult: null,
    karaoke: null,
    selectedStyle: "watercolor",
    mediaRecorder: null,
    audioChunks: [],
    audioBlob: null,
    recognition: null,
    recognizedText: "",
    isRecording: false,
    micGranted: false,
    langMode: localStorage.getItem("sing_lang_mode") || "auto",
    recognizers: [],
  };

  // --- DOM ---
  const $ = (sel) => document.querySelector(sel);
  const screens = {
    home: $("#screen-home"),
    sing: $("#screen-sing"),
    share: $("#screen-share"),
  };

  const recordBtn = $("#recordBtn");
  const recordCard = $("#recordCard");
  const recordVisual = $("#recordVisual");
  const recordHint = $("#recordHint");
  const recordStatus = $("#recordStatus");
  const recordLive = $("#recordLive");
  const recTimer = $("#recTimer");
  const waveformBars = $("#waveformBars");
  const recordRingCanvas = $("#recordRingCanvas");
  const micPermissionCard = $("#micPermissionCard");
  const requestMicBtn = $("#requestMicBtn");
  const micPermStatus = $("#micPermStatus");
  const micPermTitle = $("#micPermTitle");
  const micPermDesc = $("#micPermDesc");
  const micPermHelp = $("#micPermHelp");
  const micPermHelpSummary = $("#micPermHelpSummary");
  const micPermHelpList = $("#micPermHelpList");
  const textFallbackBtn = $("#textFallbackBtn");
  const textSearchCard = $("#textSearchCard");
  const textSearchInput = $("#textSearchInput");
  const textSearchBtn = $("#textSearchBtn");
  const textSearchBackBtn = $("#textSearchBackBtn");
  const micGrantedBadge = $("#micGrantedBadge");
  const loadingOverlay = $("#loadingOverlay");
  const loadingText = $("#loadingText");
  const toast = $("#toast");

  const BAR_COUNT = 28;
  const RING_BAR_COUNT = 48;

  // --- 录音视觉反馈 ---
  const RecordFX = (() => {
    let audioCtx = null;
    let analyser = null;
    let source = null;
    let rafId = null;
    let timerId = null;
    let recordStartMs = 0;
    let barEls = [];

    function initBars() {
      if (barEls.length) return;
      waveformBars.innerHTML = "";
      for (let i = 0; i < BAR_COUNT; i++) {
        const bar = document.createElement("span");
        bar.className = "bar";
        bar.style.height = "10px";
        waveformBars.appendChild(bar);
        barEls.push(bar);
      }
    }

    function formatRecTime(ms) {
      const sec = Math.floor(ms / 1000);
      return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
    }

    function startTimer() {
      recordStartMs = Date.now();
      recTimer.textContent = "0:00";
      timerId = setInterval(() => {
        recTimer.textContent = formatRecTime(Date.now() - recordStartMs);
      }, 200);
    }

    function stopTimer() {
      clearInterval(timerId);
      timerId = null;
    }

    function drawRing(level) {
      const canvas = recordRingCanvas;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const baseR = 78;
      const amp = 8 + level * 28;

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < RING_BAR_COUNT; i++) {
        const t = i / RING_BAR_COUNT;
        const angle = t * Math.PI * 2 - Math.PI / 2;
        const wave = 0.65 + 0.35 * Math.sin(t * Math.PI * 6 + performance.now() / 180);
        const r2 = baseR + amp * wave;
        const x1 = cx + Math.cos(angle) * baseR;
        const y1 = cy + Math.sin(angle) * baseR;
        const x2 = cx + Math.cos(angle) * r2;
        const y2 = cy + Math.sin(angle) * r2;

        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, "rgba(108, 92, 231, 0.15)");
        g.addColorStop(1, `rgba(232, 67, 147, ${0.35 + level * 0.5})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    function tickIdleRing() {
      drawRing(0.35 + 0.15 * Math.sin(performance.now() / 300));
      rafId = requestAnimationFrame(tickIdleRing);
    }

    function tickLive(dataArray) {
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const level = sum / dataArray.length / 255;

      barEls.forEach((bar, i) => {
        const idx = Math.floor((i / BAR_COUNT) * dataArray.length);
        const v = dataArray[idx] / 255;
        const h = 8 + v * 44;
        bar.style.height = `${h}px`;
        bar.style.opacity = String(0.45 + v * 0.55);
      });

      drawRing(level);
      rafId = requestAnimationFrame(() => {
        analyser.getByteFrequencyData(dataArray);
        tickLive(dataArray);
      });
    }

    function showPressing() {
      initBars();
      recordCard.classList.add("pressing");
      recordVisual.classList.add("pressing");
      recordLive.hidden = false;
      waveformBars.hidden = false;
      recordHint.textContent = "松手结束录音…";
      recTimer.textContent = "0:00";
      if (rafId) cancelAnimationFrame(rafId);
      drawRing(0.25);
      rafId = requestAnimationFrame(tickIdleRing);
      if (navigator.vibrate) navigator.vibrate(15);
    }

    function showRecording(stream) {
      recordCard.classList.remove("pressing");
      recordCard.classList.add("recording");
      recordVisual.classList.remove("pressing");
      recordVisual.classList.add("recording");
      recordHint.textContent = "正在听，哼唱或念歌词…";
      startTimer();

      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      if (rafId) cancelAnimationFrame(rafId);
      analyser.getByteFrequencyData(dataArray);
      tickLive(dataArray);
    }

    function hide() {
      recordCard.classList.remove("pressing", "recording");
      recordVisual.classList.remove("pressing", "recording");
      recordLive.hidden = true;
      waveformBars.hidden = true;
      stopTimer();

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (source) {
        try { source.disconnect(); } catch (_) {}
        source = null;
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
      analyser = null;

      barEls.forEach((bar) => {
        bar.style.height = "10px";
        bar.style.opacity = "";
      });

      const ctx = recordRingCanvas?.getContext("2d");
      ctx?.clearRect(0, 0, recordRingCanvas.width, recordRingCanvas.height);
    }

    return { showPressing, showRecording, hide };
  })();

  // --- 工具 ---
  let toastTimer;
  function showToast(msg, duration = 2500) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, duration);
  }

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name]?.classList.add("active");
  }

  function showLoading(text = "正在识别…") {
    loadingText.textContent = text;
    loadingOverlay.hidden = false;
  }

  function hideLoading() {
    loadingOverlay.hidden = true;
  }

  // --- 屏幕导航 ---
  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => showScreen(btn.dataset.back));
  });

  const HINT_READY = "按住按钮，哼唱或念出一段歌词";
  const HINT_NEED_MIC = "请先授权麦克风，再按住按钮哼唱";

  const HELP_DENIED = `
    <li><strong>Chrome / Edge：</strong>地址栏左侧 🔒 → 网站设置 → 麦克风 → 允许</li>
    <li><strong>Safari（iPhone）：</strong>设置 → Safari → 麦克风 → 允许</li>
    <li><strong>微信内置浏览器：</strong>建议复制链接到系统浏览器打开</li>`;

  const HELP_NOT_FOUND = `
    <li><strong>Windows：</strong>设置 → 隐私和安全性 → 麦克风 → 开启「麦克风访问」</li>
    <li><strong>检查硬件：</strong>插入耳机/麦克风，或确认笔记本内置麦克风未被禁用</li>
    <li><strong>远程桌面 / 虚拟机：</strong>可能无法使用本机麦克风，请换用手机或实体机</li>
    <li><strong>仍无法使用：</strong>可点击下方「改用文字输入」直接搜歌词</li>`;

  function setHelpContent(type) {
    micPermHelpSummary.textContent = type === "notfound"
      ? "未检测到麦克风？点击查看解决方法"
      : "权限被拒绝？点击查看设置方法";
    micPermHelpList.innerHTML = type === "notfound" ? HELP_NOT_FOUND : HELP_DENIED;
  }

  function showTextSearchMode(show) {
    textSearchCard.hidden = !show;
    micPermissionCard.hidden = show;
    document.getElementById("langCard").hidden = show;
    recordCard.style.display = show ? "none" : "";
    if (show) textSearchInput.focus();
  }

  function setRecordEnabled(enabled) {
    state.micGranted = enabled;
    recordCard.classList.toggle("disabled", !enabled);
    micGrantedBadge.hidden = !enabled;
    recordHint.textContent = enabled ? HINT_READY : HINT_NEED_MIC;
  }

  function updateMicUI(status) {
    micPermissionCard.classList.remove("granted", "denied", "prompt", "notfound");
    micPermStatus.classList.remove("error");
    micPermHelp.hidden = true;
    textFallbackBtn.hidden = true;
    micPermissionCard.hidden = false;

    if (status === "granted") {
      micPermissionCard.classList.add("granted");
      setRecordEnabled(true);
      return;
    }

    setRecordEnabled(false);
    micPermissionCard.classList.remove("granted");

    if (status === "denied") {
      micPermissionCard.classList.add("denied");
      micPermTitle.textContent = "麦克风权限被拒绝";
      micPermDesc.textContent = "请在浏览器设置中允许本网站使用麦克风，然后点击下方按钮重试。";
      requestMicBtn.textContent = "重新申请麦克风";
      requestMicBtn.hidden = false;
      micPermStatus.textContent = "当前无法录音";
      micPermStatus.classList.add("error");
      setHelpContent("denied");
      micPermHelp.hidden = false;
    } else if (status === "notfound") {
      micPermissionCard.classList.add("notfound");
      micPermTitle.textContent = "未检测到麦克风";
      micPermDesc.textContent = "系统找不到可用的录音设备。请检查麦克风是否已连接并在系统设置中启用。";
      requestMicBtn.textContent = "重新检测麦克风";
      requestMicBtn.hidden = false;
      textFallbackBtn.hidden = false;
      micPermStatus.textContent = "未找到录音设备";
      micPermStatus.classList.add("error");
      setHelpContent("notfound");
      micPermHelp.hidden = false;
    } else if (status === "unsupported") {
      micPermTitle.textContent = "浏览器不支持录音";
      micPermDesc.textContent = "请使用 Chrome、Edge 或 Safari，并通过 http://localhost 或 HTTPS 访问本页面。";
      requestMicBtn.hidden = true;
      textFallbackBtn.hidden = false;
      micPermStatus.textContent = "不支持 getUserMedia";
      micPermStatus.classList.add("error");
    } else {
      micPermissionCard.classList.add("prompt");
      micPermTitle.textContent = "需要麦克风权限";
      micPermDesc.innerHTML = "哼歌识曲需要访问麦克风，用于聆听你哼唱的旋律或歌词。<br />音频仅在本地识别，不会上传保存。";
      requestMicBtn.textContent = "允许使用麦克风";
      requestMicBtn.hidden = false;
      textFallbackBtn.hidden = false;
      micPermStatus.textContent = "";
      setHelpContent("denied");
    }
  }

  async function listAudioInputs() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "audioinput" && d.deviceId);
    } catch {
      return [];
    }
  }

  async function acquireMicStream() {
    const attempts = [
      () => navigator.mediaDevices.getUserMedia({ audio: true }),
      () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false } }),
    ];

    let lastError;
    for (const tryGet of attempts) {
      try {
        return await tryGet();
      } catch (err) {
        lastError = err;
        if (err.name !== "NotFoundError" && err.name !== "OverconstrainedError") throw err;
      }
    }

    const inputs = await listAudioInputs();
    for (const dev of inputs) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: dev.deviceId } },
        });
      } catch (err) {
        lastError = err;
      }
    }

    const err = lastError || new DOMException("未找到麦克风设备", "NotFoundError");
    throw err;
  }

  function mapMicError(err) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") return "denied";
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") return "notfound";
    if (String(err.message || "").toLowerCase().includes("not found")) return "notfound";
    return "prompt";
  }

  function micErrorMessage(err, status) {
    if (status === "denied") return "您拒绝了麦克风权限";
    if (status === "notfound") return "未检测到麦克风，请检查设备与系统设置";
    return `授权失败：${err.message || "请重试"}`;
  }

  async function checkMicPermission() {
    if (!navigator.mediaDevices?.getUserMedia) {
      updateMicUI("unsupported");
      return;
    }

    if (IOSApp.isIOS && !IOSApp.isSecure) {
      micPermTitle.textContent = "需要 HTTPS 安全连接";
      micPermDesc.innerHTML = "iPhone / iPad 的麦克风只能在 <strong>HTTPS</strong> 或 localhost 下使用。<br />请用 ngrok 或部署到 GitHub Pages 后，再用 Safari 打开。";
      textFallbackBtn.hidden = false;
      micPermStatus.textContent = "当前不是安全连接，无法使用麦克风";
      micPermStatus.classList.add("error");
      setHelpContent("denied");
      micPermHelp.hidden = false;
      setRecordEnabled(false);
      return;
    }

    if (navigator.permissions?.query) {
      try {
        const result = await navigator.permissions.query({ name: "microphone" });
        updateMicUI(result.state);
        result.onchange = () => updateMicUI(result.state);
        return;
      } catch (_) {
        /* Safari 等浏览器可能不支持 microphone 查询 */
      }
    }

    updateMicUI("prompt");
  }

  async function requestMicPermission() {
    if (!navigator.mediaDevices?.getUserMedia) {
      updateMicUI("unsupported");
      showToast("当前浏览器不支持麦克风");
      return false;
    }

    requestMicBtn.disabled = true;
    micPermStatus.classList.remove("error");
    micPermStatus.textContent = "等待授权…";

    try {
      const stream = await acquireMicStream();
      stream.getTracks().forEach((t) => t.stop());
      updateMicUI("granted");
      micPermStatus.textContent = "✓ 授权成功，可以开始哼歌了";
      showToast("麦克风已就绪");
      return true;
    } catch (err) {
      const status = mapMicError(err);
      updateMicUI(status);
      micPermStatus.textContent = micErrorMessage(err, status);
      micPermStatus.classList.add("error");
      if (status === "denied" || status === "notfound") micPermHelp.hidden = false;
      showToast(status === "denied" ? "请在浏览器中允许麦克风" : status === "notfound" ? "未检测到麦克风" : "麦克风授权失败");
      console.error(err);
      return false;
    } finally {
      requestMicBtn.disabled = false;
    }
  }

  requestMicBtn.addEventListener("click", requestMicPermission);
  textFallbackBtn.addEventListener("click", () => showTextSearchMode(true));
  textSearchBackBtn.addEventListener("click", () => showTextSearchMode(false));
  textSearchBtn.addEventListener("click", () => {
    const text = textSearchInput.value.trim();
    if (!text) {
      showToast("请输入歌词或歌名");
      return;
    }
    showLoading("正在匹配歌曲…");
    SongMatcher.matchByText(text).then((match) => {
      hideLoading();
      if (match) {
        state.matchResult = match;
        openSingScreen(match);
      } else {
        showToast("暂未匹配到歌曲，换个关键词试试");
      }
    });
  });
  textSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") textSearchBtn.click();
  });
  checkMicPermission();

  // --- 识曲语言 ---
  function getRecognitionLangs() {
    if (state.langMode === "zh") return ["zh-CN"];
    if (state.langMode === "en") return ["en-US"];
    if (state.langMode === "ja") return ["ja-JP"];
    return ["zh-CN", "en-US", "ja-JP"];
  }

  function initLangSwitch() {
    document.querySelectorAll(".lang-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === state.langMode);
      btn.addEventListener("click", () => {
        state.langMode = btn.dataset.lang;
        localStorage.setItem("sing_lang_mode", state.langMode);
        document.querySelectorAll(".lang-pill").forEach((b) => {
          b.classList.toggle("active", b.dataset.lang === state.langMode);
        });
        const hints = {
          en: "English mode · hold to sing or speak lyrics",
          ja: "日本語モード · ボタンを押して歌う",
        };
        const langHints = {
          auto: "自动模式：中 / 英 / 日 均可识别",
          zh: "中文模式：哼中文歌或念中文歌词",
          en: "English mode: speak English lyrics",
          ja: "日本語：lemon や日本語歌詞を唱えて",
        };
        if (state.micGranted) recordHint.textContent = hints[state.langMode] || HINT_READY;
        const langHintEl = document.getElementById("langHint");
        if (langHintEl) langHintEl.textContent = langHints[state.langMode] || langHints.auto;
        refreshLangHint();
        const toasts = {
          en: "已切换 English 识曲",
          zh: "已切换中文识曲",
          ja: "已切换日本語识曲",
          auto: "已切换自动识曲（中/英/日）",
        };
        showToast(toasts[state.langMode] || toasts.auto);
      });
    });
  }
  initLangSwitch();

  function refreshLangHint() {
    const langHints = {
      auto: "自动模式：中 / 英 / 日 均可识别",
      zh: "中文模式：哼中文歌或念中文歌词",
      en: "English mode: speak English lyrics",
      ja: "日本語：lemon や日本語歌詞を唱えて",
    };
    const el = document.getElementById("langHint");
    if (el) el.textContent = langHints[state.langMode] || langHints.auto;
  }
  refreshLangHint();

  // --- 服务器连接 ---
  function updateServerUI() {
    const statusEl = document.getElementById("asrStatus");
    const badge = document.getElementById("asrBadge");
    const on = ApiClient.isConfigured();
    if (statusEl) {
      statusEl.textContent = on
        ? `✓ 已连接 ${ApiClient.getBaseUrl()} · 松手后服务端 ASR 识别`
        : "未连接服务器 · 使用浏览器识别（准确度较低）";
      statusEl.classList.toggle("on", on);
    }
    if (badge) badge.hidden = !on;
    const urlInput = document.getElementById("serverUrlInput");
    if (urlInput && on && !urlInput.value) urlInput.value = ApiClient.getBaseUrl();
  }

  function initServerSettings() {
    const savedUrl = localStorage.getItem("sing_api_base");
    const urlInput = document.getElementById("serverUrlInput");
    if (urlInput && savedUrl) urlInput.value = savedUrl;

    document.getElementById("saveServerBtn")?.addEventListener("click", async () => {
      const url = document.getElementById("serverUrlInput")?.value?.trim();
      const secret = document.getElementById("serverSecretInput")?.value?.trim() || "";
      if (!url) {
        showToast("请输入服务器地址");
        return;
      }
      if (!/^https?:\/\//i.test(url)) {
        showToast("地址需以 http:// 或 https:// 开头");
        return;
      }
      ApiClient.saveConfig(url, secret);
      showLoading("正在连接服务器…");
      try {
        const health = await ApiClient.health();
        hideLoading();
        if (!health.asr) {
          showToast("服务器已连接，但未配置 OPENAI_API_KEY");
        } else {
          showToast("服务器连接成功 · ASR 已就绪");
        }
        updateServerUI();
      } catch (err) {
        hideLoading();
        ApiClient.clearConfig();
        updateServerUI();
        showToast(`连接失败：${err.message}`);
      }
    });

    document.getElementById("clearServerBtn")?.addEventListener("click", () => {
      ApiClient.clearConfig();
      const u = document.getElementById("serverUrlInput");
      const s = document.getElementById("serverSecretInput");
      if (u) u.value = "";
      if (s) s.value = "";
      updateServerUI();
      showToast("已清除服务器配置");
    });

    updateServerUI();
  }
  initServerSettings();

  function startSpeechRecognition() {
    stopSpeechRecognition();
    state.recognizedText = "";

    // 已启用 Whisper 时不跑浏览器识别（不准且浪费）
    if (ASR.isEnabled()) {
      recordStatus.textContent = "录音中 · 松手后用 AI 识别歌词";
      return;
    }

    const langs = getRecognitionLangs();
    state.recognizers = langs.map((lang) => createSpeechRecognition(lang)).filter(Boolean);
    state.recognizers.forEach((rec) => {
      try { rec.start(); } catch (_) {}
    });
  }

  function stopSpeechRecognition() {
    state.recognizers.forEach((rec) => {
      try { rec.stop(); } catch (_) {}
    });
    state.recognizers = [];
    state.recognition = null;
  }

  // --- 录音 ---
  let isStarting = false;

  async function startRecording() {
    if (state.isRecording || isStarting) return;

    if (!state.micGranted) {
      micPermissionCard.scrollIntoView({ behavior: "smooth", block: "center" });
      micPermissionCard.style.animation = "none";
      void micPermissionCard.offsetWidth;
      micPermissionCard.style.animation = "fadeIn 0.35s ease, permShake 0.4s ease";
      showToast("请先允许使用麦克风");
      await requestMicPermission();
      if (!state.micGranted) return;
    }

    isStarting = true;
    RecordFX.showPressing();

    try {
      const stream = await acquireMicStream();
      state.audioChunks = [];
      state.recognizedText = "";
      state.audioBlob = null;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      state.mediaRecorder = new MediaRecorder(stream, { mimeType });

      state.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) state.audioChunks.push(e.data);
      };

      state.mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        state.audioBlob = new Blob(state.audioChunks, { type: mimeType });
        await processRecording();
      };

      state.mediaRecorder.start(200);
      state.isRecording = true;
      isStarting = false;
      RecordFX.showRecording(stream);
      recordStatus.textContent = "";

      startSpeechRecognition();
    } catch (err) {
      isStarting = false;
      RecordFX.hide();
      recordHint.textContent = state.micGranted ? HINT_READY : HINT_NEED_MIC;
      const status = mapMicError(err);
      if (status === "notfound") updateMicUI("notfound");
      else if (status === "denied") updateMicUI("denied");
      showToast(status === "notfound" ? "未检测到麦克风，可改用文字输入" : "无法访问麦克风，请检查权限");
      console.error(err);
    }
  }

  function stopRecording() {
    if (!state.isRecording && !isStarting) {
      RecordFX.hide();
      return;
    }

    if (isStarting && !state.isRecording) {
      isStarting = false;
      RecordFX.hide();
      recordHint.textContent = HINT_READY;
      return;
    }

    if (!state.isRecording) return;

    state.isRecording = false;
    isStarting = false;
    RecordFX.hide();
    recordHint.textContent = HINT_READY;

    stopSpeechRecognition();

    if (state.mediaRecorder?.state !== "inactive") {
      recordStatus.textContent = "识别中，请稍候…";
      state.mediaRecorder.stop();
    }
  }

  function createSpeechRecognition(lang = "zh-CN") {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) state.recognizedText += (state.recognizedText ? " " : "") + final.trim();
      const display = state.recognizedText + (interim ? " " + interim : "");
      if (display.trim()) recordStatus.textContent = `识别中：${display.trim().slice(-36)}`;
    };

    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("Speech error:", lang, e.error);
      }
    };

    if (!state.recognition) state.recognition = rec;
    return rec;
  }

  // 按住录音交互
  recordBtn.addEventListener("mousedown", startRecording);
  recordBtn.addEventListener("mouseup", stopRecording);
  recordBtn.addEventListener("mouseleave", stopRecording);
  recordBtn.addEventListener("touchstart", (e) => { e.preventDefault(); startRecording(); }, { passive: false });
  recordBtn.addEventListener("touchend", (e) => { e.preventDefault(); stopRecording(); });
  recordBtn.addEventListener("touchcancel", (e) => { e.preventDefault(); stopRecording(); });

  // --- 识曲处理 ---
  async function processRecording() {
    if (!state.audioBlob || state.audioBlob.size < 1000) {
      showToast("录音太短，请再试一次（至少 2 秒）");
      return;
    }

    let recognizedText = state.recognizedText;

    try {
      if (ASR.isEnabled()) {
        showLoading("服务端 ASR 识别歌词…");
        try {
          const asr = await ASR.transcribe(state.audioBlob, { langMode: state.langMode });
          if (asr?.text) {
            recognizedText = ASR.mergeTranscripts(asr.text, state.recognizedText);
            recordStatus.textContent = `ASR：${recognizedText.slice(0, 40)}${recognizedText.length > 40 ? "…" : ""}`;
          }
        } catch (asrErr) {
          console.error(asrErr);
          showToast(`ASR 失败：${asrErr.message}${recognizedText ? " · 使用备用识别" : ""}`);
          if (!recognizedText) {
            hideLoading();
            recordStatus.textContent = "ASR 失败 · 请检查 Key 或重试";
            return;
          }
        }
      }

      if (!recognizedText?.trim()) {
        hideLoading();
        showToast("没听清歌词，请大声念出歌名或歌词片段");
        recordStatus.textContent = "未识别到文字 · 可重试";
        return;
      }

      showLoading("正在匹配歌曲…");

      let auddResult = null;
      if (window.APP_CONFIG.auddToken) {
        auddResult = await tryAuddRecognition(state.audioBlob);
      }

      const match = await SongMatcher.match(recognizedText, state.audioBlob);

      hideLoading();

      if (auddResult) {
        const localMatch = SONG_DATABASE.find(
          (s) => s.title.includes(auddResult.title) || auddResult.title.includes(s.title)
        );
        if (localMatch) {
          state.matchResult = { song: localMatch, confidence: 95, method: "api" };
        } else {
          showToast(`识别到：${auddResult.title} - ${auddResult.artist}（暂无歌词）`);
          return;
        }
      } else if (match) {
        state.matchResult = match;
        if (ASR.isEnabled()) state.matchResult.method = "asr";
      } else {
        showToast(`未匹配到歌曲 · 识别文字：${recognizedText.slice(0, 20)}…`);
        recordStatus.textContent = "未匹配 · 可换语言或文字输入";
        return;
      }

      state.recognizedText = recognizedText;
      openSingScreen(state.matchResult);
    } catch (err) {
      hideLoading();
      showToast("识别出错，请重试");
      console.error(err);
    }
  }

  async function tryAuddRecognition(blob) {
    const form = new FormData();
    form.append("api_token", window.APP_CONFIG.auddToken);
    form.append("return", "apple_music,spotify");
    form.append("file", blob, "recording.webm");

    const res = await fetch("https://api.audd.io/", { method: "POST", body: form });
    const data = await res.json();
    if (data.result) {
      return { title: data.result.title, artist: data.result.artist };
    }
    return null;
  }

  // --- 跟唱界面 ---
  function openSingScreen(matchResult) {
    const { song, confidence } = matchResult;
    state.currentSong = song;
    const bpm = song.bpm || 72;

    $("#songTitle").textContent = song.title;
    $("#songArtist").textContent = song.artist;
    const methodLabels = { api: "在线识曲", asr: "服务端 ASR", text: "智能匹配" };
    $("#matchBadge").textContent = `匹配度 ${confidence}% · ${methodLabels[matchResult.method] || "智能匹配"}`;
    $("#bpmLabel").textContent = `${bpm} BPM`;

    const lines = LyricsEngine.parseLrc(song.lrc);
    const container = $("#lyricsScroll");
    state.karaoke = new LyricsEngine.KaraokePlayer(container, lines, { bpm });

    state.beatBar = LyricsEngine.initBeatBar($("#beatBar"));
    state.karaoke.onBeat = (beatInBar) => {
      state.beatBar.pulse(beatInBar);
      const panel = document.querySelector(".beat-panel");
      panel?.classList.remove("pulsing");
      void panel?.offsetWidth;
      panel?.classList.add("pulsing");
    };

    const progressFill = $("#progressFill");
    const timeDisplay = $("#timeDisplay");
    const playBtn = $("#singPlayBtn");

    state.karaoke.onTimeUpdate = (current, total) => {
      progressFill.style.width = `${(current / total) * 100}%`;
      timeDisplay.textContent = `${LyricsEngine.formatTime(current)} / ${LyricsEngine.formatTime(total)}`;
    };

    state.karaoke.onEnd = () => {
      playBtn.textContent = "▶ 重新开始";
      playBtn.classList.remove("playing");
      state.beatBar?.reset();
    };

    playBtn.textContent = "▶ 开始跟唱";
    playBtn.classList.remove("playing");
    progressFill.style.width = "0%";
    timeDisplay.textContent = "0:00 / " + LyricsEngine.formatTime(state.karaoke.duration);

    showScreen("sing");
    showToast(`找到了！《${song.title}》`);
  }

  const singPlayBtn = $("#singPlayBtn");
  singPlayBtn.addEventListener("click", () => {
    if (!state.karaoke) return;
    if (state.karaoke.playing) {
      state.karaoke.pause();
      singPlayBtn.textContent = "▶ 继续跟唱";
      singPlayBtn.classList.remove("playing");
      state.beatBar?.reset();
    } else {
      if (state.karaoke.currentTime >= state.karaoke.duration - 0.5) {
        state.karaoke.reset();
      }
      state.karaoke.play(state.karaoke.currentTime);
      singPlayBtn.textContent = "⏸ 暂停";
      singPlayBtn.classList.add("playing");
    }
  });

  // --- 分享心情 ---
  $("#goShareBtn").addEventListener("click", () => {
    initShareScreen();
    showScreen("share");
  });

  function initShareScreen() {
    renderStyleGrid();
    generateMoodText();
  }

  function getActiveLyricLine() {
    if (!state.karaoke || state.karaoke.activeIndex < 0) return "";
    return state.karaoke.lines[state.karaoke.activeIndex]?.text || "";
  }

  async function generateMoodText() {
    if (!state.currentSong) return;
    const textarea = $("#moodText");
    textarea.value = "生成中…";

    const activeLine = getActiveLyricLine();
    const text = await MoodGenerator.generateWithAI(state.currentSong, activeLine);
    textarea.value = text;
  }

  function renderStyleGrid() {
    const grid = $("#styleGrid");
    grid.innerHTML = ShareImage.STYLES.map(
      (s) => `
      <button type="button" class="style-option ${s.id === state.selectedStyle ? "selected" : ""}" data-style="${s.id}">
        <span class="emoji">${s.emoji}</span>
        ${s.name}
      </button>`
    ).join("");

    grid.querySelectorAll(".style-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedStyle = btn.dataset.style;
        grid.querySelectorAll(".style-option").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });
  }

  $("#regenTextBtn").addEventListener("click", generateMoodText);

  $("#copyTextBtn").addEventListener("click", async () => {
    const text = $("#moodText").value;
    try {
      await navigator.clipboard.writeText(text);
      showToast("文案已复制，去微信粘贴吧");
    } catch {
      showToast("复制失败，请手动选择复制");
    }
  });

  $("#genImageBtn").addEventListener("click", () => {
    if (!state.currentSong) return;
    const moodText = $("#moodText").value.trim();
    if (!moodText) {
      showToast("请先生成或输入文案");
      return;
    }

    const canvas = $("#shareCanvas");
    ShareImage.render(canvas, {
      songTitle: state.currentSong.title,
      songArtist: state.currentSong.artist,
      moodText,
      styleId: state.selectedStyle,
    });

    $("#previewCard").hidden = false;
    showToast("分享图已生成");
  });

  $("#copyImageBtn").addEventListener("click", async () => {
    const canvas = $("#shareCanvas");
    const ok = await ShareImage.copyToClipboard(canvas);
    if (ok) {
      showToast("图片已复制！打开微信长按粘贴");
    } else {
      showToast("浏览器不支持复制图片，请用「保存到相册」");
    }
  });

  $("#saveImageBtn").addEventListener("click", () => {
    ShareImage.download($("#shareCanvas"), `哼歌心情-${state.currentSong?.title || "分享"}.png`);
    showToast("图片已保存");
  });

  // --- 快捷演示（无麦克风时开发测试）---
  if (location.search.includes("demo=1")) {
    setRecordEnabled(true);
    micPermissionCard.classList.add("granted");
    setTimeout(() => {
      state.recognizedText = "故事的小黄花";
      state.audioBlob = new Blob([new ArrayBuffer(2000)]);
      SongMatcher.match(state.recognizedText, state.audioBlob).then((m) => {
        if (m) openSingScreen(m);
      });
    }, 500);
  }
})();
