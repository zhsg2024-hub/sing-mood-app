/**
 * 哼歌助手 · 服务端
 * - POST /api/asr/transcribe  Whisper ASR（Key 仅存服务器）
 * - POST /api/mood/generate   心情文案（可选）
 * - GET  /api/health
 */
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const WHISPER_MODEL = process.env.WHISPER_MODEL || "whisper-1";
const API_SECRET = process.env.API_SECRET || "";

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

function requireOpenAI(_req, res, next) {
  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: "服务器未配置 OPENAI_API_KEY" });
  }
  next();
}

const ASR_PROMPTS = {
  zh: "以下是一段中文歌曲的歌词演唱或念白，请准确转写汉字歌词。",
  en: "This is someone singing or speaking English song lyrics. Transcribe accurately.",
  ja: "これは日本語の歌詞を歌ったり読んだりした音声です。正確に書き起こしてください。",
  auto: "This is someone singing or speaking song lyrics in Chinese, English, or Japanese.",
};

const LANG_MAP = { zh: "zh", en: "en", ja: "ja", auto: null };

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    asr: Boolean(OPENAI_API_KEY),
    auth: Boolean(API_SECRET),
    version: "1.0.0",
  });
});

app.post(
  "/api/asr/transcribe",
  requireClientAuth,
  requireOpenAI,
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file?.buffer?.length) {
        return res.status(400).json({ error: "缺少音频文件 audio" });
      }

      const langMode = req.body.langMode || "auto";
      const lang = LANG_MAP[langMode] ?? null;
      const prompt = ASR_PROMPTS[langMode] || ASR_PROMPTS.auto;

      const ext = req.file.mimetype?.includes("mp4")
        ? "mp4"
        : req.file.mimetype?.includes("wav")
          ? "wav"
          : "webm";

      const form = new FormData();
      form.append(
        "file",
        new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" }),
        `recording.${ext}`
      );
      form.append("model", WHISPER_MODEL);
      form.append("response_format", "json");
      form.append("prompt", prompt);
      if (lang) form.append("language", lang);

      const oaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: form,
      });

      const data = await oaiRes.json().catch(() => ({}));
      if (!oaiRes.ok) {
        return res.status(oaiRes.status).json({
          error: data.error?.message || "Whisper 识别失败",
        });
      }

      res.json({
        text: (data.text || "").trim(),
        provider: "openai-whisper",
        language: lang || "auto",
      });
    } catch (err) {
      console.error("ASR error:", err);
      res.status(500).json({ error: err.message || "服务器错误" });
    }
  }
);

app.post("/api/mood/generate", requireClientAuth, requireOpenAI, async (req, res) => {
  try {
    const { title, artist, activeLine } = req.body || {};
    if (!title) return res.status(400).json({ error: "缺少 title" });

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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

    const data = await oaiRes.json();
    if (!oaiRes.ok) {
      return res.status(oaiRes.status).json({
        error: data.error?.message || "文案生成失败",
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

app.listen(PORT, () => {
  console.log(`sing-mood-server http://localhost:${PORT}`);
  console.log(`ASR: ${OPENAI_API_KEY ? "enabled" : "DISABLED (set OPENAI_API_KEY)"}`);
  if (allowedOrigins.length) console.log(`CORS: ${allowedOrigins.join(", ")}`);
});
