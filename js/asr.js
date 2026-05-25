/**
 * ASR 语音识别模块
 * 优先：OpenAI Whisper API（比浏览器 Web Speech 准确得多）
 * 备选：浏览器 Web Speech（无密钥时）
 */
const ASR = (() => {
  const LANG_MAP = {
    zh: "zh",
    en: "en",
    ja: "ja",
    auto: null,
  };

  function getConfig() {
    const cfg = window.APP_CONFIG || {};
    const key = cfg.openaiKey || localStorage.getItem("sing_openai_key") || "";
    return {
      openaiKey: key.trim(),
      model: cfg.whisperModel || "whisper-1",
      provider: cfg.asrProvider || "openai",
    };
  }

  function isEnabled() {
    return Boolean(getConfig().openaiKey);
  }

  function blobToFile(blob, name = "recording.webm") {
    const type = blob.type || "audio/webm";
    const ext = type.includes("mp4") ? "mp4" : type.includes("wav") ? "wav" : "webm";
    return new File([blob], name.endsWith(ext) ? name : `recording.${ext}`, { type });
  }

  /** OpenAI Whisper 语音转文字 */
  async function transcribeOpenAI(blob, langMode = "auto") {
    const { openaiKey, model } = getConfig();
    if (!openaiKey) throw new Error("未配置 OpenAI API Key");

    const file = blobToFile(blob);
    const form = new FormData();
    form.append("file", file);
    form.append("model", model);
    form.append("response_format", "json");

    const lang = LANG_MAP[langMode];
    if (lang) form.append("language", lang);

    const prompts = {
      zh: "以下是一段中文歌曲的歌词演唱或念白，请准确转写汉字歌词。",
      en: "This is someone singing or speaking English song lyrics. Transcribe accurately.",
      ja: "これは日本語の歌詞を歌ったり読んだりした音声です。正確に書き起こしてください。",
      auto: "This is someone singing or speaking song lyrics in Chinese, English, or Japanese.",
    };
    form.append("prompt", prompts[langMode] || prompts.auto);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error?.message || res.statusText || "ASR 请求失败";
      throw new Error(msg);
    }

    return {
      text: (data.text || "").trim(),
      provider: "openai-whisper",
      language: lang || "auto",
    };
  }

  /**
   * 主入口：有 Key 走 Whisper，否则返回 null 由调用方用 Web Speech 结果
   */
  async function transcribe(blob, options = {}) {
    const langMode = options.langMode || "auto";
    if (!isEnabled()) return null;

    const result = await transcribeOpenAI(blob, langMode);
    return result;
  }

  /** 合并 ASR 与浏览器实时识别，优先 ASR */
  function mergeTranscripts(asrText, liveText) {
    const a = (asrText || "").trim();
    const b = (liveText || "").trim();
    if (a && b && a !== b) {
      return a.length >= b.length ? a : `${a} ${b}`.trim();
    }
    return a || b;
  }

  return {
    isEnabled,
    getConfig,
    transcribe,
    mergeTranscripts,
    LANG_MAP,
  };
})();
