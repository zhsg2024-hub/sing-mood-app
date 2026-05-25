/**
 * 歌曲匹配引擎
 * 支持：语音识别文本模糊匹配 + 简单音频特征辅助
 */
const SongMatcher = (() => {
  /** 编辑距离（Levenshtein） */
  function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  /** 相似度 0~1 */
  function similarity(a, b) {
    if (!a || !b) return 0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - levenshtein(a, b) / maxLen;
  }

  /** 提取歌词行（去掉时间戳和元信息） */
  function extractLyricLines(lrc) {
    return lrc
      .split("\n")
      .map((line) => line.replace(/^\[\d{2}:\d{2}[.\d]*\]/, "").trim())
      .filter((line) => line && !line.includes(" - "));
  }

  /** 从识别文本匹配歌曲 */
  function matchByText(recognizedText, songs = SONG_DATABASE) {
    const text = recognizedText.replace(/\s+/g, "").toLowerCase();
    if (!text) return null;

    let best = null;
    let bestScore = 0;

    for (const song of songs) {
      let score = 0;

      // 标题/歌手匹配
      const titleSim = similarity(text, song.title.replace(/\s/g, ""));
      const artistSim = similarity(text, song.artist.replace(/\s/g, ""));
      score = Math.max(score, titleSim * 1.2, artistSim * 0.6);

      // 关键词匹配
      for (const kw of song.keywords) {
        if (text.includes(kw) || kw.includes(text.slice(0, Math.min(4, text.length)))) {
          score = Math.max(score, 0.5 + kw.length / 20);
        }
      }

      // 歌词行模糊匹配
      const lines = extractLyricLines(song.lrc);
      for (const line of lines) {
        const clean = line.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
        if (clean.length < 2) continue;

        // 子串包含
        if (text.includes(clean) || clean.includes(text)) {
          score = Math.max(score, 0.85);
          continue;
        }

        // 滑动窗口比较
        for (let i = 0; i <= clean.length - 2; i++) {
          const chunk = clean.slice(i, i + Math.min(text.length + 2, clean.length - i));
          const sim = similarity(text, chunk);
          if (sim > 0.55) score = Math.max(score, sim);
        }

        const lineSim = similarity(text, clean);
        if (lineSim > 0.45) score = Math.max(score, lineSim);
      }

      if (score > bestScore) {
        bestScore = score;
        best = { song, score, method: "text" };
      }
    }

    if (best && bestScore >= 0.35) {
      best.confidence = Math.min(99, Math.round(bestScore * 100));
      return best;
    }
    return null;
  }

  /**
   * 从音频 blob 提取简单特征（平均频率能量分布）
   * 用于辅助匹配（演示级，非专业指纹）
   */
  async function extractAudioFingerprint(blob) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // 分 8 段计算 RMS 能量
    const segments = 8;
    const segLen = Math.floor(data.length / segments);
    const fingerprint = [];
    for (let s = 0; s < segments; s++) {
      let sum = 0;
      const start = s * segLen;
      for (let i = start; i < start + segLen; i++) {
        sum += data[i] * data[i];
      }
      fingerprint.push(Math.sqrt(sum / segLen));
    }

    // 估算主频率（过零率近似）
    let zeroCrossings = 0;
    const step = Math.floor(data.length / 8000);
    for (let i = step; i < data.length; i += step) {
      if ((data[i] >= 0) !== (data[i - step] >= 0)) zeroCrossings++;
    }
    const estimatedPitch = (zeroCrossings * sampleRate) / (2 * (data.length / step));

    ctx.close();
    return { fingerprint, estimatedPitch, duration: audioBuffer.duration };
  }

  /** 综合匹配：优先文本，音频作为辅助排序 */
  async function match(recognizedText, audioBlob) {
    const textResult = matchByText(recognizedText);

    if (audioBlob) {
      try {
        const fp = await extractAudioFingerprint(audioBlob);
        // 根据时长和音高微调置信度（演示逻辑）
        if (textResult) {
          if (fp.duration >= 3 && fp.duration <= 30) {
            textResult.confidence = Math.min(99, textResult.confidence + 5);
          }
          textResult.audioMeta = fp;
        }
      } catch (_) {
        /* 音频解码失败不影响文本匹配 */
      }
    }

    return textResult;
  }

  return { match, matchByText, similarity };
})();
