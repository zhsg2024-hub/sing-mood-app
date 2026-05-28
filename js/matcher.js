/**
 * 歌曲匹配引擎
 * 支持：中文 + 英文 + 日文歌词/歌名模糊匹配
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
    const kana = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    const cjk = (text.match(/[\u4e00-\u9faf]/g) || []).length;
    return latin > kana && latin > cjk;
  }

  function hasJapanese(text) {
    return /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
  }

  function normalizeEnglish(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
  }

  function normalizeCjk(text) {
    return text.toLowerCase().replace(/[\s\u3000]/g, "");
  }

  function normalizeJapanese(text) {
    return text
      .toLowerCase()
      .replace(/[\s\u3000]/g, "")
      .replace(/[^\u3040-\u309f\u30a0-\u30ffa-z0-9\u4e00-\u9faf]/g, "");
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

  function cleanLine(line, lang) {
    if (lang === "en") {
      return line.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
    }
    if (lang === "ja") {
      return line.replace(/[^\u3040-\u309f\u30a0-\u30ffa-zA-Z0-9\u4e00-\u9faf]/g, "");
    }
    return line.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
  }

  function matchKeywords(text, textEn, keywords, lang) {
    let score = 0;
    for (const kw of keywords || []) {
      const kwEn = normalizeEnglish(kw);
      const kwJa = normalizeJapanese(kw);
      const kwZh = normalizeCjk(kw);

      if (lang === "en") {
        if (text.includes(kwEn.replace(/\s/g, "")) || wordOverlapScore(textEn, kwEn) > 0.5) {
          score = Math.max(score, 0.55 + kwEn.length / 25);
        }
      } else if (lang === "ja") {
        if (text.includes(kwJa) || kwJa.includes(text.slice(0, Math.min(4, text.length)))) {
          score = Math.max(score, 0.5 + kwJa.length / 18);
        }
        if (kwEn && (textEn.includes(kwEn) || wordOverlapScore(textEn, kwEn) > 0.8)) {
          score = Math.max(score, 0.65 + kwEn.length / 20);
        }
      } else if (text.includes(kwZh) || kwZh.includes(text.slice(0, Math.min(4, text.length)))) {
        score = Math.max(score, 0.5 + kwZh.length / 20);
      }
    }
    return score;
  }

  function scoreCjkLyrics(text, lines, lang = "zh") {
    let score = 0;
    for (const line of lines) {
      const clean = typeof line === "string" && line.length < 80 && !line.includes("[")
        ? line
        : cleanLine(line, lang);
      if (clean.length < 2) continue;
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
    return score;
  }

  function scoreSong(textRaw, song) {
    const lang = song.lang || "zh";
    const textEn = normalizeEnglish(textRaw);
    const textEnCompact = textEn.replace(/\s/g, "");
    const textJa = normalizeJapanese(textRaw);
    const textZh = normalizeCjk(textRaw);

    let text = textZh;
    if (lang === "en") text = textEnCompact;
    if (lang === "ja") text = textJa;

    if (!text && !textEn) return 0;

    let score = 0;

    if (lang === "en") {
      score = Math.max(score, wordOverlapScore(textEn, normalizeEnglish(song.title)) * 1.3);
      score = Math.max(score, wordOverlapScore(textEn, normalizeEnglish(song.artist)) * 0.7);
      score = Math.max(score, similarity(textEnCompact, normalizeEnglish(song.title).replace(/\s/g, "")) * 1.1);
    } else if (lang === "ja") {
      const titleEn = normalizeEnglish(song.title);
      const artistJa = normalizeJapanese(song.artist);
      if (titleEn) {
        score = Math.max(score, wordOverlapScore(textEn, titleEn) * 1.35);
        score = Math.max(score, similarity(textEnCompact, titleEn.replace(/\s/g, "")) * 1.15);
      }
      score = Math.max(score, similarity(textJa, normalizeJapanese(song.title)) * 1.2);
      score = Math.max(score, similarity(textJa, artistJa) * 0.65);
    } else {
      score = Math.max(score, similarity(textZh, normalizeCjk(song.title)) * 1.2);
      score = Math.max(score, similarity(textZh, normalizeCjk(song.artist)) * 0.6);
    }

    score = Math.max(score, matchKeywords(text, textEn, song.keywords, lang));

    const lines = extractLyricLines(song.lrc);
    if (lang === "en") {
      for (const line of lines) {
        const clean = cleanLine(line, "en");
        if (clean.length < 2) continue;
        const overlap = wordOverlapScore(textEn, clean);
        if (overlap > 0.45) score = Math.max(score, 0.7 + overlap * 0.25);
        if (textEnCompact.includes(clean.replace(/\s/g, "")) || clean.includes(textEn)) score = Math.max(score, 0.88);
        const lineSim = similarity(textEnCompact, clean.replace(/\s/g, ""));
        if (lineSim > 0.5) score = Math.max(score, lineSim);
      }
    } else if (lang === "ja") {
      score = Math.max(score, scoreCjkLyrics(textJa, lines, "ja"));
      for (const line of lines) {
        const clean = cleanLine(line, "en");
        if (clean.length >= 3 && textEnCompact) {
          const overlap = wordOverlapScore(textEn, clean);
          if (overlap > 0.5) score = Math.max(score, 0.75 + overlap * 0.2);
        }
      }
    } else {
      score = Math.max(score, scoreCjkLyrics(textZh, lines, "zh"));
    }

    return score;
  }

  function matchThreshold(text) {
    if (isLatinDominant(text)) return 0.32;
    if (hasJapanese(text)) return 0.33;
    return 0.35;
  }

  function matchByText(recognizedText, songs = SONG_DATABASE) {
    if (!recognizedText?.trim()) return null;

    const scored = [];
    for (const song of songs) {
      const score = scoreSong(recognizedText, song);
      if (score > 0) scored.push({ song, score, method: "text" });
    }
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    const second = scored[1];
    if (!best) return null;

    const threshold = matchThreshold(recognizedText);
    if (best.score < threshold) return null;

    // 多首歌得分接近且输入较短 → 交给 AI 消歧
    const textLen = recognizedText.replace(/\s/g, "").length;
    if (second && best.score - second.score < 0.1 && textLen <= 8) return null;

    return {
      song: best.song,
      score: best.score,
      method: "text",
      confidence: Math.min(99, Math.round(best.score * 100)),
    };
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

  function buildFromLlmIdentify(data) {
    if (!data?.title?.trim() || !data?.lrc?.trim()) return null;

    const title = data.title.trim();
    const artist = (data.originalArtist || data.artist || "").trim();
    if (!artist) return null;
    const confidence = Math.min(99, Math.round(Number(data.confidence) || 75));
    const bpm = Math.min(180, Math.max(60, Number(data.bpm) || 72));

    const song = {
      id: `llm-${Date.now()}`,
      title,
      artist,
      lang: "zh",
      bpm,
      keywords: [],
      lrc: data.lrc.trim(),
    };

    return {
      song,
      confidence,
      method: "llm",
      inLibrary: false,
      reason: data.reason || "",
      matchedLyric: data.matchedLyric || "",
    };
  }

  return { match, matchByText, buildFromLlmIdentify, similarity, isLatinDominant, hasJapanese };
})();
