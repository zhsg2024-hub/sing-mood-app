/**
 * 歌曲匹配引擎
 * 支持：中文 + 英文歌词/歌名模糊匹配
 */
const SongMatcher = (() => {
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

  function similarity(a, b) {
    if (!a || !b) return 0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - levenshtein(a, b) / maxLen;
  }

  function isLatinDominant(text) {
    const latin = (text.match(/[a-zA-Z]/g) || []).length;
    const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    return latin > cjk;
  }

  /** 中文：去空格；英文：保留单词边界 */
  function normalizeText(text, preferLatin) {
    const raw = text.toLowerCase().trim();
    const latin = preferLatin ?? isLatinDominant(raw);
    if (latin) {
      return raw.replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
    }
    return raw.replace(/\s+/g, "");
  }

  function wordTokens(text) {
    return text.split(/\s+/).filter((w) => w.length > 0);
  }

  function wordOverlapScore(a, b) {
    const wa = wordTokens(a);
    const wb = wordTokens(b);
    if (!wa.length || !wb.length) return 0;
    const setB = new Set(wb);
    let hit = 0;
    for (const w of wa) {
      if (setB.has(w)) hit++;
      else {
        for (const bw of wb) {
          if (bw.includes(w) || w.includes(bw)) { hit += 0.7; break; }
        }
      }
    }
    return hit / Math.max(wa.length, wb.length);
  }

  function extractLyricLines(lrc) {
    return lrc
      .split("\n")
      .map((line) => line.replace(/^\[\d{2}:\d{2}[.\d]*\]/, "").trim())
      .filter((line) => line && !/^.+\s-\s.+$/.test(line));
  }

  function cleanLine(line, isEn) {
    if (isEn) return line.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
    return line.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
  }

  function scoreSong(textRaw, song) {
    const isEn = song.lang === "en" || (song.lang !== "zh" && isLatinDominant(textRaw));
    const text = normalizeText(textRaw, isEn);
    if (!text) return 0;

    let score = 0;
    const titleNorm = normalizeText(song.title, isEn);
    const artistNorm = normalizeText(song.artist, isEn);

    if (isEn) {
      score = Math.max(score, wordOverlapScore(text, titleNorm) * 1.3);
      score = Math.max(score, wordOverlapScore(text, artistNorm) * 0.7);
      score = Math.max(score, similarity(text.replace(/\s/g, ""), titleNorm.replace(/\s/g, "")) * 1.1);
    } else {
      score = Math.max(score, similarity(text, titleNorm.replace(/\s/g, "")) * 1.2);
      score = Math.max(score, similarity(text, artistNorm.replace(/\s/g, "")) * 0.6);
    }

    for (const kw of song.keywords || []) {
      const kwNorm = normalizeText(kw, isEn);
      if (isEn) {
        if (text.includes(kwNorm) || wordOverlapScore(text, kwNorm) > 0.5) {
          score = Math.max(score, 0.55 + kwNorm.length / 25);
        }
      } else if (text.includes(kwNorm) || kwNorm.includes(text.slice(0, Math.min(4, text.length)))) {
        score = Math.max(score, 0.5 + kwNorm.length / 20);
      }
    }

    const lines = extractLyricLines(song.lrc);
    for (const line of lines) {
      const clean = cleanLine(line, isEn);
      if (clean.length < 2) continue;

      if (isEn) {
        const overlap = wordOverlapScore(text, clean);
        if (overlap > 0.45) score = Math.max(score, 0.7 + overlap * 0.25);
        if (text.includes(clean) || clean.includes(text)) score = Math.max(score, 0.88);
        const lineSim = similarity(text.replace(/\s/g, ""), clean.replace(/\s/g, ""));
        if (lineSim > 0.5) score = Math.max(score, lineSim);
      } else {
        if (text.includes(clean) || clean.includes(text)) {
          score = Math.max(score, 0.85);
          continue;
        }
        for (let i = 0; i <= clean.length - 2; i++) {
          const chunk = clean.slice(i, i + Math.min(text.length + 2, clean.length - i));
          const sim = similarity(text, chunk);
          if (sim > 0.55) score = Math.max(score, sim);
        }
        const lineSim = similarity(text, clean);
        if (lineSim > 0.45) score = Math.max(score, lineSim);
      }
    }

    return score;
  }

  function matchByText(recognizedText, songs = SONG_DATABASE) {
    if (!recognizedText?.trim()) return null;

    let best = null;
    let bestScore = 0;

    for (const song of songs) {
      const score = scoreSong(recognizedText, song);
      if (score > bestScore) {
        bestScore = score;
        best = { song, score, method: "text" };
      }
    }

    const threshold = isLatinDominant(recognizedText) ? 0.32 : 0.35;
    if (best && bestScore >= threshold) {
      best.confidence = Math.min(99, Math.round(bestScore * 100));
      return best;
    }
    return null;
  }

  async function extractAudioFingerprint(blob) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    const segments = 8;
    const segLen = Math.floor(data.length / segments);
    const fingerprint = [];
    for (let s = 0; s < segments; s++) {
      let sum = 0;
      const start = s * segLen;
      for (let i = start; i < start + segLen; i++) sum += data[i] * data[i];
      fingerprint.push(Math.sqrt(sum / segLen));
    }

    let zeroCrossings = 0;
    const step = Math.floor(data.length / 8000);
    for (let i = step; i < data.length; i += step) {
      if ((data[i] >= 0) !== (data[i - step] >= 0)) zeroCrossings++;
    }
    const estimatedPitch = (zeroCrossings * sampleRate) / (2 * (data.length / step));

    ctx.close();
    return { fingerprint, estimatedPitch, duration: audioBuffer.duration };
  }

  async function match(recognizedText, audioBlob) {
    const textResult = matchByText(recognizedText);

    if (audioBlob) {
      try {
        const fp = await extractAudioFingerprint(audioBlob);
        if (textResult) {
          if (fp.duration >= 3 && fp.duration <= 30) {
            textResult.confidence = Math.min(99, textResult.confidence + 5);
          }
          textResult.audioMeta = fp;
        }
      } catch (_) {}
    }

    return textResult;
  }

  return { match, matchByText, similarity, isLatinDominant };
})();
