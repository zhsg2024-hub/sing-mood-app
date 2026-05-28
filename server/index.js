/**
 * 哼歌助手 · 服务端
 * - POST /api/asr/transcribe  ASR（OpenAI Whisper 或 百炼 Qwen-ASR）
 * - POST /api/mood/generate   心情文案
 * - GET  /api/health
 */
require("dotenv").config();

const fs = require("fs");
const http = require("http");
const https = require("https");
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const PROVIDER = (process.env.LLM_PROVIDER || "bailian").toLowerCase();
const API_KEY = process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY || "";
const BASE_URL = (
  process.env.DASHSCOPE_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  (PROVIDER === "openai"
    ? "https://api.openai.com/v1"
    : "https://dashscope.aliyuncs.com/compatible-mode/v1")
).replace(/\/$/, "");
const CHAT_MODEL =
  process.env.CHAT_MODEL || (PROVIDER === "openai" ? "gpt-4o-mini" : "qwen-turbo");
const IDENTIFY_MODEL =
  process.env.IDENTIFY_MODEL || (PROVIDER === "openai" ? "gpt-4o-mini" : "qwen-plus");
const ASR_MODEL =
  process.env.ASR_MODEL || (PROVIDER === "openai" ? "whisper-1" : "qwen3-asr-flash");
const API_SECRET = process.env.API_SECRET || "";
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH || "";
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH || "";
const HOST = process.env.HOST || "0.0.0.0";

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS blocked: ${origin}`));
      }
    },
  })
);

app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function requireClientAuth(req, res, next) {
  if (!API_SECRET) return next();
  const key = req.headers["x-api-key"];
  if (key !== API_SECRET) {
    return res.status(401).json({ error: "无效的 API 连接密钥" });
  }
  next();
}

function requireApiKey(_req, res, next) {
  if (!API_KEY) {
    return res.status(503).json({
      error:
        PROVIDER === "openai"
          ? "服务器未配置 OPENAI_API_KEY"
          : "服务器未配置 DASHSCOPE_API_KEY",
    });
  }
  next();
}

function apiHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${API_KEY}`,
    ...extra,
  };
}

const ASR_LANG_MAP = { zh: "zh", en: "en", ja: "ja" };

const ASR_PROMPTS = {
  zh: "以下是一段中文歌曲的歌词演唱或念白，请准确转写汉字歌词。",
  en: "This is someone singing or speaking English song lyrics. Transcribe accurately.",
  ja: "これは日本語の歌詞を歌ったり読んだりした音声です。正確に書き起こしてください。",
  auto: "This is someone singing or speaking song lyrics in Chinese, English, or Japanese.",
};

const LANG_MAP = { zh: "zh", en: "en", ja: "ja", auto: null };

function mimeForUpload(mimetype) {
  if (mimetype?.includes("wav")) return "audio/wav";
  if (mimetype?.includes("mp4") || mimetype?.includes("m4a")) return "audio/mp4";
  if (mimetype?.includes("mpeg") || mimetype?.includes("mp3")) return "audio/mpeg";
  if (mimetype?.includes("webm")) return "audio/webm";
  return mimetype || "audio/webm";
}

async function transcribeWithBailian(buffer, mimetype, langMode) {
  const mime = mimeForUpload(mimetype);
  const base64 = buffer.toString("base64");
  const dataUri = `data:${mime};base64,${base64}`;

  const asrOptions = { enable_itn: false };
  const lang = ASR_LANG_MAP[langMode];
  if (lang) asrOptions.language = lang;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      model: ASR_MODEL,
      stream: false,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: { data: dataUri },
            },
          ],
        },
      ],
      asr_options: asrOptions,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || data.message || `百炼 ASR 失败 (${res.status})`);
  }

  const text = (data.choices?.[0]?.message?.content || "").trim();
  return { text, provider: "bailian-qwen-asr", language: lang || "auto" };
}

async function transcribeWithOpenAI(buffer, mimetype, langMode) {
  const lang = LANG_MAP[langMode] ?? null;
  const prompt = ASR_PROMPTS[langMode] || ASR_PROMPTS.auto;

  const ext = mimetype?.includes("mp4")
    ? "mp4"
    : mimetype?.includes("wav")
      ? "wav"
      : "webm";

  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], { type: mimetype || "audio/webm" }),
    `recording.${ext}`
  );
  form.append("model", ASR_MODEL);
  form.append("response_format", "json");
  form.append("prompt", prompt);
  if (lang) form.append("language", lang);

  const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: apiHeaders(),
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Whisper 识别失败 (${res.status})`);
  }

  return {
    text: (data.text || "").trim(),
    provider: "openai-whisper",
    language: lang || "auto",
  };
}

function normalizeLrc(raw, title, artist, bpm = 72) {
  let text = (raw || "").trim();
  const block = text.match(/```[\w]*\s*([\s\S]*?)```/i);
  if (block) text = block[1].trim();

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const hasLrc = lines.some((l) => /^\[\d{2}:\d{2}[.:]\d{2,3}\]/.test(l));
  if (hasLrc) return lines.join("\n");

  const step = 3.2;
  let t = 0;
  const out = [`[00:00.00]${title} - ${artist}`];
  for (const line of lines) {
    if (/^[\d:\.\[\]\s-]+$/.test(line)) continue;
    if (line.includes(title) && line.includes(artist)) continue;
    t += step;
    const mm = String(Math.floor(t / 60)).padStart(2, "0");
    const ss = String(Math.floor(t % 60)).padStart(2, "0");
    const cs = String(Math.floor((t % 1) * 100)).padStart(2, "0");
    out.push(`[${mm}:${ss}.${cs}]${line}`);
  }
  return out.join("\n");
}

async function generateLyricsForSong(title, artist, text, bpm = 72) {
  const lrcRaw = await chatComplete(
    [
      {
        role: "system",
        content: `你是歌词专家。请输出「${title}」原唱 ${artist} 版本的标准歌词，LRC 格式。
要求：
1. 第一行：[00:00.00]${title} - ${artist}
2. 每行 [mm:ss.ss]歌词，约每 3~4 秒一行
3. 主歌+副歌完整段落，至少 16 行
4. 只输出 LRC，不要 markdown`,
      },
      {
        role: "user",
        content: `请输出《${title}》（原唱：${artist}）的完整 LRC。用户哼唱/念词片段：${text.trim()}`,
      },
    ],
    2500,
    IDENTIFY_MODEL
  );
  return normalizeLrc(lrcRaw, title, artist, bpm);
}

function candidateScore(c) {
  return (Number(c.confidence) || 0) * 0.45 + (Number(c.distinctiveness) || 0) * 0.55;
}

function normalizeCandidates(raw) {
  const list = Array.isArray(raw?.candidates) ? raw.candidates : [];
  return list
    .filter((c) => c?.title)
    .map((c) => ({
      title: String(c.title).trim(),
      artist: String(c.artist || c.originalArtist || "").trim(),
      confidence: Math.min(99, Math.max(0, Number(c.confidence) || 0)),
      distinctiveness: Math.min(99, Math.max(0, Number(c.distinctiveness) || 0)),
      matchedLyric: String(c.matchedLyric || "").trim(),
      reason: String(c.reason || "").trim(),
      bpm: Math.min(180, Math.max(60, Number(c.bpm) || 72)),
    }))
    .sort((a, b) => candidateScore(b) - candidateScore(a));
}

function shouldAskUserToPick(candidates, ambiguousFlag) {
  if (candidates.length <= 1) return false;
  const best = candidates[0];
  const second = candidates[1];
  const gap = candidateScore(best) - candidateScore(second);
  if (ambiguousFlag) return true;
  if (best.distinctiveness < 58) return true;
  if (best.confidence < 78 && candidates.length > 1) return true;
  if (gap < 12) return true;
  return false;
}

async function identifyCandidates(text, langMode = "auto") {
  const langHint =
    langMode === "en"
      ? "可能是英文歌"
      : langMode === "ja"
        ? "可能是日文歌"
        : langMode === "zh"
          ? "可能是中文歌"
          : "可能是中文、英文或日文歌";

  const raw = await chatComplete(
    [
      {
        role: "system",
        content: `你是专业音乐识曲引擎。输入来自 ASR，可能有错字。

关键规则（非常重要）：
- 很多歌词在多首歌里重复（如「我爱你」「对不起」「后来」「想你」「回忆」「温柔」「孤独」等）
- 若输入是常见短句，必须列出多首候选，不要武断只返回一首
- distinctiveness：该输入对某首歌的唯一性（0-100，越高越能确定）
- 输入越短、越常见，confidence 应越低
- title 为正式歌名，artist 为原唱

只输出 JSON：
{"ambiguous":true,"candidates":[{"title":"","artist":"","confidence":0,"distinctiveness":0,"bpm":72,"matchedLyric":"","reason":""}]}`,
      },
      { role: "user", content: `${langHint}\n\n用户输入：\n${text.trim()}` },
    ],
    800,
    IDENTIFY_MODEL
  );

  const parsed = parseJsonFromContent(raw);
  const candidates = normalizeCandidates(parsed);
  if (!candidates.length) throw new Error("AI 未能识别歌曲");
  return { candidates, ambiguous: Boolean(parsed.ambiguous) };
}

async function verifyCandidate(text, langMode, candidate) {
  const langHint =
    langMode === "zh" ? "中文歌" : langMode === "en" ? "英文歌" : langMode === "ja" ? "日文歌" : "中/英/日";

  const raw = await chatComplete(
    [
      {
        role: "system",
        content: `核对歌曲候选是否正确。确保 title 为正式歌名、artist 为原唱。若输入是常见歌词且该候选不对，返回 corrected:true 并给出更合适的 title/artist。
只输出 JSON：{"title":"","artist":"","confidence":0,"bpm":72,"corrected":false,"reason":""}`,
      },
      {
        role: "user",
        content: `${langHint}
用户输入：${text.trim()}
候选：《${candidate.title}》 - ${candidate.artist}
匹配句：${candidate.matchedLyric || ""}`,
      },
    ],
    350,
    IDENTIFY_MODEL
  );

  const v = parseJsonFromContent(raw);
  if (!v?.title) return candidate;
  return {
    ...candidate,
    title: String(v.title).trim(),
    artist: String(v.artist || candidate.artist).trim(),
    confidence: Math.min(99, Number(v.confidence) || candidate.confidence),
    bpm: Math.min(180, Math.max(60, Number(v.bpm) || candidate.bpm)),
    reason: String(v.reason || candidate.reason).trim(),
  };
}

async function buildSongResult(title, artist, text, meta = {}) {
  const bpm = Math.min(180, Math.max(60, Number(meta.bpm) || 72));
  const lrc = await generateLyricsForSong(title, artist, text, bpm);
  return {
    title,
    artist,
    originalArtist: artist,
    confidence: Math.min(99, Math.max(0, Number(meta.confidence) || 75)),
    bpm,
    lrc,
    matchedLyric: String(meta.matchedLyric || "").trim(),
    reason: String(meta.reason || "").trim(),
    provider: PROVIDER,
  };
}

async function identifySongWithLyrics(text, langMode = "auto", forced = null) {
  if (forced?.title) {
    const artist = String(forced.artist || "").trim();
    if (!artist) throw new Error("缺少原唱歌手");
    const verified = await verifyCandidate(text, langMode, {
      title: forced.title.trim(),
      artist,
      confidence: forced.confidence || 80,
      bpm: forced.bpm || 72,
      matchedLyric: forced.matchedLyric || "",
      reason: forced.reason || "",
    });
    return buildSongResult(verified.title, verified.artist, text, verified);
  }

  const { candidates, ambiguous } = await identifyCandidates(text, langMode);

  if (shouldAskUserToPick(candidates, ambiguous)) {
    return {
      needsPick: true,
      ambiguous: true,
      candidates: candidates.slice(0, 4),
      hint: "这段歌词可能对应多首歌，请选择正确的一首",
    };
  }

  const best = await verifyCandidate(text, langMode, candidates[0]);
  if (!best.artist) throw new Error("AI 未能识别原唱歌手");
  return buildSongResult(best.title, best.artist, text, best);
}

function parseJsonFromContent(content) {
  const text = (content || "").trim();
  const block = text.match(/```json?\s*([\s\S]*?)```/i);
  const raw = block ? block[1].trim() : text;
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("AI 返回格式无效");
  }
}

async function chatComplete(messages, maxTokens = 200, model = CHAT_MODEL) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: model === IDENTIFY_MODEL ? 0.15 : 0.3,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.message || "大模型调用失败");
  }
  return data.choices?.[0]?.message?.content?.trim() || "";
}

app.get("/", (_req, res) => {
  res.json({
    name: "哼歌助手服务端",
    ok: true,
    health: "/api/health",
    hint: "前端请连接此地址（不含路径），例如 https://192.168.88.16:3000",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    asr: Boolean(API_KEY),
    auth: Boolean(API_SECRET),
    provider: PROVIDER,
    chatModel: CHAT_MODEL,
    identifyModel: IDENTIFY_MODEL,
    asrModel: ASR_MODEL,
    https: Boolean(HTTPS_KEY_PATH && HTTPS_CERT_PATH),
    version: "1.3.0",
  });
});

app.post(
  "/api/asr/transcribe",
  requireClientAuth,
  requireApiKey,
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file?.buffer?.length) {
        return res.status(400).json({ error: "缺少音频文件 audio" });
      }

      const langMode = req.body.langMode || "auto";
      const result =
        PROVIDER === "openai"
          ? await transcribeWithOpenAI(req.file.buffer, req.file.mimetype, langMode)
          : await transcribeWithBailian(req.file.buffer, req.file.mimetype, langMode);

      res.json(result);
    } catch (err) {
      console.error("ASR error:", err);
      res.status(500).json({ error: err.message || "服务器错误" });
    }
  }
);

app.post("/api/song/guess", requireClientAuth, requireApiKey, async (req, res) => {
  try {
    const { text, langMode = "auto" } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: "缺少 text" });
    const result = await identifySongWithLyrics(text, langMode);
    res.json(result);
  } catch (err) {
    console.error("Guess error:", err);
    res.status(500).json({ error: err.message || "猜歌失败" });
  }
});

app.post("/api/song/identify", requireClientAuth, requireApiKey, async (req, res) => {
  try {
    const { text, langMode = "auto", title, artist, confidence, bpm, matchedLyric, reason } =
      req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: "缺少 text" });
    const forced = title ? { title, artist, confidence, bpm, matchedLyric, reason } : null;
    const result = await identifySongWithLyrics(text, langMode, forced);
    res.json(result);
  } catch (err) {
    console.error("Identify error:", err);
    res.status(500).json({ error: err.message || "识曲失败" });
  }
});

app.post("/api/mood/generate", requireClientAuth, requireApiKey, async (req, res) => {
  try {
    const { title, artist, activeLine } = req.body || {};
    if (!title) return res.status(400).json({ error: "缺少 title" });

    const resChat = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "你是文艺朋友圈文案助手。用简短、有感染力的中文写一段分享哼歌心情的文案，80字以内，适合发微信。不要标题，不要 hashtag。",
          },
          {
            role: "user",
            content: `歌曲：《${title}》${artist || ""}${activeLine ? `，刚唱到「${activeLine}」` : ""}`,
          },
        ],
        max_tokens: 150,
      }),
    });

    const data = await resChat.json();
    if (!resChat.ok) {
      return res.status(resChat.status).json({
        error: data.error?.message || data.message || "文案生成失败",
      });
    }

    res.json({
      text: data.choices?.[0]?.message?.content?.trim() || "",
    });
  } catch (err) {
    console.error("Mood error:", err);
    res.status(500).json({ error: err.message || "服务器错误" });
  }
});

function startServer() {
  const onListen = (scheme) => {
    console.log(`sing-mood-server ${scheme}://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
    if (HOST === "0.0.0.0") console.log(`LAN: ${scheme}://192.168.88.16:${PORT} (按实际 IP 替换)`);
    console.log(`Provider: ${PROVIDER} | Identify: ${IDENTIFY_MODEL} | Chat: ${CHAT_MODEL} | ASR: ${ASR_MODEL}`);
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`ASR: ${API_KEY ? "enabled" : "DISABLED (set DASHSCOPE_API_KEY)"}`);
    if (allowedOrigins.length) console.log(`CORS: ${allowedOrigins.join(", ")}`);
  };

  if (HTTPS_KEY_PATH && HTTPS_CERT_PATH) {
    const ssl = {
      key: fs.readFileSync(HTTPS_KEY_PATH),
      cert: fs.readFileSync(HTTPS_CERT_PATH),
    };
    https.createServer(ssl, app).listen(PORT, HOST, () => onListen("https"));
    return;
  }

  http.createServer(app).listen(PORT, HOST, () => onListen("http"));
}

startServer();
