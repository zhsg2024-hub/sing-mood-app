/**
 * ASR 语音识别 · 客户端
 * 通过自有服务器调用 Whisper（Key 不暴露给浏览器）
 */
const ASR = (() => {
  function isEnabled() {
    return ApiClient.isConfigured();
  }

  function blobToFile(blob) {
    const type = blob.type || "audio/webm";
    const ext = type.includes("mp4") ? "mp4" : type.includes("wav") ? "wav" : "webm";
    return new File([blob], `recording.${ext}`, { type });
  }

  async function transcribe(blob, options = {}) {
    if (!isEnabled()) return null;

    const base = ApiClient.getBaseUrl();
    const form = new FormData();
    form.append("audio", blobToFile(blob));
    form.append("langMode", options.langMode || "auto");

    const res = await fetch(`${base}/api/asr/transcribe`, {
      method: "POST",
      headers: ApiClient.buildHeaders(),
      body: form,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `ASR 失败 (${res.status})`);
    }

    return {
      text: (data.text || "").trim(),
      provider: data.provider || "server-whisper",
      language: data.language || "auto",
    };
  }

  function mergeTranscripts(asrText, liveText) {
    const a = (asrText || "").trim();
    const b = (liveText || "").trim();
    if (a && b && a !== b) {
      return a.length >= b.length ? a : `${a} ${b}`.trim();
    }
    return a || b;
  }

  return { isEnabled, transcribe, mergeTranscripts };
})();
