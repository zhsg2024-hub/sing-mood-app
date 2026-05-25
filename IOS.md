# iPhone / iPad 使用指南

哼歌助手已支持 **iPhone 和 iPad**，无需 App Store，通过 Safari 安装到主屏幕即可像 App 一样使用。

---

## 为什么需要手机 / 平板？

- 电脑没有麦克风时，无法哼歌录音
- iPhone / iPad 自带麦克风，体验最佳
- 可「添加到主屏幕」，全屏使用

---

## 第一步：部署到 HTTPS（必须）

iOS 的 Safari **只允许在 HTTPS 下使用麦克风**（`http://192.168.x.x` 不行）。

### 方案 A：免费云端部署（推荐）

1. 把整个 `sing-mood-app` 文件夹上传到 **GitHub**
2. 开启 **GitHub Pages**（Settings → Pages → 选 main 分支）
3. 得到地址如：`https://你的用户名.github.io/sing-mood-app/`

或使用 [Vercel](https://vercel.com)、[Netlify](https://netlify.com) 一键部署。

### 方案 B：本地临时 HTTPS（开发测试）

在电脑上进入项目目录，启动服务：

```bash
cd sing-mood-app
python -m http.server 8080
```

另开终端，用 ngrok 暴露 HTTPS：

```bash
ngrok http 8080
```

复制 ngrok 给出的 **`https://xxxx.ngrok.io`** 链接。

---

## 第二步：iPhone / iPad 打开

1. 用 **Safari** 打开 HTTPS 链接（❌ 不要用微信内置浏览器）
2. 首次会提示 **允许使用麦克风** → 点「允许」
3. 按住 🎤 按钮哼歌即可

---

## 第三步：添加到主屏幕（像 App 一样）

| 步骤 | 操作 |
|------|------|
| 1 | Safari 打开页面 |
| 2 | 点击底部 **分享** 按钮（□ 上有箭头） |
| 3 | 向下滑，点 **「添加到主屏幕」** |
| 4 | 点 **添加** |
| 5 | 从主屏幕 **哼歌助手** 图标打开 |

添加后：
- 全屏显示，无 Safari 地址栏
- 支持离线缓存（第二次打开更快）
- 麦克风权限会记住

---

## iPad 说明

- 与 iPhone 步骤相同
- 界面自动适配大屏，歌词字更大
- 横屏也可正常使用

---

## 常见问题

**Q：微信里打不开麦克风？**  
A：点右上角「…」→ **在 Safari 中打开**。

**Q：提示需要 HTTPS？**  
A：必须用 `https://` 开头的地址，不能用局域网 IP 的 `http://`。

**Q：电脑没有麦克风怎么办？**  
A：在电脑上用 **「文字识曲」** 输入歌词；完整哼歌体验请用 iPhone / iPad。

**Q：能上架 App Store 吗？**  
A：当前是 PWA 网页版。若要原生 App，需 Mac + Xcode 打包，可后续再做。

---

## 文件说明

| 文件 | 作用 |
|------|------|
| `manifest.json` | PWA 配置，支持添加到主屏幕 |
| `sw.js` | 离线缓存 |
| `ios.css` | iPhone / iPad 布局优化 |
| `js/ios.js` | 设备检测与安装引导 |
