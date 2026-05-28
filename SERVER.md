# 哼歌助手 · 服务端部署

前端（GitHub Pages）只负责录音和界面；**OpenAI Key 只放在服务端**，浏览器里只配置服务器地址。

## 架构

```
iPad / 浏览器 (客户端)          你的服务器 (Node.js)           OpenAI
─────────────────────          ─────────────────────          ──────
录音 → 上传音频  ──POST──→  /api/asr/transcribe  ──→  Whisper
识曲匹配（本地）               Key 在 .env
分享文案请求  ──POST──→  /api/mood/generate   ──→  GPT-4o-mini
```

## 本地启动

```bash
cd sing-mood-app/server
npm install
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY
npm start
```

默认监听 `http://localhost:3000`。

验证：

```bash
curl http://localhost:3000/api/health
# {"ok":true,"asr":true,"auth":false,"version":"1.0.0"}
```

## 环境变量 (.env)

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | 是 | OpenAI API Key（仅服务器） |
| `PORT` | 否 | 端口，默认 3000 |
| `WHISPER_MODEL` | 否 | 默认 `whisper-1` |
| `API_SECRET` | 否 | 客户端连接密钥，对应前端「连接密钥」 |
| `ALLOWED_ORIGINS` | 建议 | 逗号分隔，如 `https://zhsg2024-hub.github.io` |

### CORS 示例

部署到 Render/Railway 后，在 `.env` 或平台环境变量里设置：

```
ALLOWED_ORIGINS=https://zhsg2024-hub.github.io,http://localhost:8080
API_SECRET=your-random-secret-here
OPENAI_API_KEY=sk-...
```

## 客户端连接

1. 打开 [哼歌助手 Pages](https://zhsg2024-hub.github.io/sing-mood-app/)
2. 展开 **「连接服务器」**
3. 填入服务器地址，如 `https://your-app.onrender.com`
4. 若设置了 `API_SECRET`，填入相同连接密钥
5. 点 **测试并保存**

成功后录音区会显示 **「服务端 ASR」** 徽章。

## 部署到 Render（免费层）

1. 将仓库推送到 GitHub
2. [Render](https://render.com) → New → **Web Service**
3. 连接仓库，**Root Directory** 设为 `server`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. 在 Environment 添加 `OPENAI_API_KEY`、`ALLOWED_ORIGINS`、`API_SECRET`
7. 部署完成后复制 URL，填到 iPad 客户端

## 部署到 Railway

1. New Project → Deploy from GitHub
2. 选择仓库，设置 **Root Directory** 为 `server`
3. 添加环境变量（同上）
4. 生成域名后填入客户端

## API 接口

### GET /api/health

检查服务与 ASR 是否就绪。

### POST /api/asr/transcribe

- Header: `X-Api-Key`（若配置了 `API_SECRET`）
- Body: `multipart/form-data`
  - `audio`: 录音文件
  - `langMode`: `auto` | `zh` | `en` | `ja`

### POST /api/mood/generate

- Header: `X-Api-Key`（可选）
- Body: JSON `{ "title", "artist", "activeLine" }`

## 费用参考

- Whisper：约 **$0.006 / 分钟**
- GPT-4o-mini 文案：极低，可按需关闭（未连服务器时用本地模板）

## 安全建议

1. **务必** 设置 `API_SECRET`，防止他人滥用你的服务器
2. **务必** 设置 `ALLOWED_ORIGINS` 限制来源
3. 在 OpenAI 后台设置 **用量上限**
4. **不要** 把 `.env` 提交到 GitHub
