# 哼歌助手 🎵

面向「爱哼歌但常忘歌词、爱分享心情」用户的 Web 应用。

## 功能

| 功能 | 说明 |
|------|------|
| **按住录音** | 哼旋律或念歌词，支持跑调、念错字 |
| **智能识曲** | 语音识别 + 歌词模糊匹配（可选 AudD 在线 API） |
| **KTV 歌词** | LRC 时间轴，高亮当前行，自动滚动 |
| **版权说明** | **不播放原曲**（避免版权风险），仅歌词跟唱提示 |
| **分享心情** | 自动生成文案 + 6 种风格分享图 |
| **微信分享** | 一键复制文案/图片，粘贴到微信 |
| **iPhone / iPad** | PWA 版，可添加到主屏幕，详见 [IOS.md](./IOS.md) |

## iPhone / iPad 版（推荐无麦克风电脑用户使用）

电脑没有麦克风时，请用 **iPhone 或 iPad**：

1. 将项目部署到 **HTTPS**（GitHub Pages / Vercel / ngrok）
2. 用 **Safari** 打开链接
3. 分享 → **添加到主屏幕**
4. 从主屏幕打开，允许麦克风，即可哼歌

详细步骤见 **[IOS.md](./IOS.md)**。

## 快速启动

### 方式一：直接打开（功能受限）

双击 `index.html` 或用浏览器打开。  
⚠️ 麦克风与语音识别需要 **HTTPS 或 localhost**，建议用下方本地服务器。

### 方式二：本地服务器（推荐）

```bash
cd sing-mood-app

# Python
python -m http.server 8080

# 或 Node（若已安装）
npx serve .
```

浏览器访问：`http://localhost:8080`

### 演示模式

访问 `http://localhost:8080?demo=1` 可跳过录音，直接体验《晴天》跟唱与分享。

## 使用流程

1. **按住** 🎤 按钮，哼唱或念出一段歌词（2～15 秒）
2. 松开后自动识曲，进入 **跟唱页**
3. 点 **开始跟唱**，歌词会按节奏高亮（无原曲，可自己哼或清唱）
4. 点 **分享这段唱歌心情** → 生成文案 → 选风格 → 生成图片
5. **复制文案/图片**，到微信聊天框粘贴

## 内置示例歌曲

- 晴天、稻香、后来、平凡之路、小幸运、成都

可编辑 `js/songs.js` 添加更多歌曲及 LRC 歌词。

## 版权说明

**原曲音乐受著作权保护**，本应用默认：

- ✅ 展示歌词（仅供个人学习跟唱）
- ✅ 歌词时间轴同步提示
- ❌ **不嵌入、不播放** 原版 MP3/流媒体

如需正版伴奏，建议后续对接 licensed 音乐 API（如腾讯音乐开放平台）。

## 可选 API 扩展

### ⚠️ API Key 安全（重要）

本应用是 **GitHub Pages 静态网页**，没有后端。若在页面里填写 OpenAI Key：

- Key 存在 **iPad 本地 localStorage**
- 请求时 Key 从 **浏览器直接** 发给 OpenAI（网络面板可见）
- **存在泄露风险**：他人使用你的设备、恶意脚本、误截图等

**请务必：**

1. **不要** 把 Key 写进 `app.js` 或提交到 GitHub
2. 仅在 ASR 设置里 **个人填写**，并勾选风险确认
3. 在 [OpenAI 用量限制](https://platform.openai.com/settings/organization/limits) 设置 **每月上限**
4. 不用时点 **「清除」** 删除本机 Key
5. 正式对外产品应改用 **后端代理**（Cloudflare Workers 等），Key 不放前端

### 配置项

```javascript
// 仅本地调试可写在 app.js，切勿 push 到公开仓库
window.APP_CONFIG = {
  auddToken: "...",      // AudD 同样有前端泄露风险
};
// OpenAI Key 请用页面「ASR 设置」填写，不要写进代码
```

## 技术栈

- 纯 HTML / CSS / JavaScript，无需 npm 构建
- Web Audio API（录音）
- Web Speech API（语音识别）
- Canvas（分享图生成）
- LRC 格式歌词 + requestAnimationFrame 同步

## 目录结构

```
sing-mood-app/
├── index.html
├── styles.css
├── README.md
└── js/
    ├── app.js          # 主逻辑
    ├── songs.js        # 歌曲库
    ├── matcher.js      # 模糊匹配
    ├── lyrics.js       # KTV 歌词引擎
    ├── mood.js         # 文案生成
    └── share-image.js  # 分享图渲染
```

## 后续可扩展

- [ ] 接入 ACRCloud / Shazam 级哼唱识别
- [ ] 歌词 API（网易云、QQ 音乐开放平台）
- [ ] 正版伴奏授权播放
- [x] 打包为 PWA（iPhone / iPad 添加到主屏幕）
- [ ] 微信小程序
- [ ] 用户登录与分享历史
