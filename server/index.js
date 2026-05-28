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

async function identifySongWithLyrics(text, langMode = "auto") {
  const langHint =
    langMode === "en"
      ? "可能是英文歌，歌词用英文"
      : langMode === "ja"
        ? "可能是日文歌，歌词用日文"
        : langMode === "zh"
          ? "可能是中文歌，歌词用中文"
          : "可能是中文、英文或日文歌";

  const guessRaw = await chatComplete(
    [
      {
        role: "system",
        content:
          '你是音乐识曲专家。根据用户哼唱/念出的文字推测歌曲。只输出 JSON：{"title":"歌名","artist":"歌手","confidence":0-100,"bpm":72,"reason":"简短理由"}',
      },
      { role: "user", content: `${langHint}。用户输入：\n${text.trim()}` },
    ],
    300
  );

  const guess = parseJsonFromContent(guessRaw);
  if (!guess?.title) throw new Error("AI 未能识别歌曲");

  const title = String(guess.title).trim();
  const artist = String(guess.artist || "").trim();
  const bpm = Math.min(180, Math.max(60, Number(guess.bpm) || 72));

  const lrcRaw = await chatComplete(
    [
      {
        role: "system",
        content: `你是歌词专家。输出标准 LRC 歌词，用于跟唱展示。
要求：
1. 第一行：[00:00.00]${title} - ${artist}
2. 每行格式 [mm:ss.ss]歌词，时间递增，约每 3~4 秒一行
3. 输出主歌+副歌等主要段落，尽量完整（至少 16 行歌词）
4. 只输出 LRC 文本，不要 markdown、不要解释
5. BPM 约 ${bpm}`,
      },
      {
        role: "user",
        content: `请输出《${title}》${artist ? `- ${artist}` : ""}的常用演唱版完整歌词（LRC 格式）。用户刚唱到的片段：${text.trim()}`,
      },
    ],
    2500
  );

  const lrc = normalizeLrc(lrcRaw, title, artist, bpm);

  return {
    title,
    artist,
    confidence: Math.min(99, Math.max(0, Number(guess.confidence) || 75)),
    bpm,
    lrc,
    reason: String(guess.reason || "").trim(),
    provider: PROVIDER,
  };
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

async function chatComplete(messages, maxTokens = 200) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
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
    asrModel: ASR_MODEL,
    https: Boolean(HTTPS_KEY_PATH && HTTPS_CERT_PATH),
    version: "1.1.0",
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
    const { text, langMode = "auto" } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: "缺少 text" });
    const result = await identifySongWithLyrics(text, langMode);
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
    console.log(`Provider: ${PROVIDER} | Chat: ${CHAT_MODEL} | ASR: ${ASR_MODEL}`);
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
