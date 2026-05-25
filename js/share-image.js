/**
 * 分享图生成 - 多风格 Canvas 渲染
 */
const ShareImage = (() => {
  const STYLES = [
    { id: "watercolor", name: "水彩文艺", emoji: "🎨", bg: ["#fef9f3", "#fdebd0", "#fadbd8"], text: "#5d4037" },
    { id: "minimal", name: "极简白", emoji: "⬜", bg: ["#ffffff", "#f5f5f5", "#eeeeee"], text: "#212121" },
    { id: "retro", name: "复古胶片", emoji: "📷", bg: ["#3e2723", "#5d4037", "#795548"], text: "#ffcc80" },
    { id: "neon", name: "霓虹夜", emoji: "🌃", bg: ["#0a0a1a", "#1a0a2e", "#16213e"], text: "#e040fb" },
    { id: "sakura", name: "樱花粉", emoji: "🌸", bg: ["#fff0f5", "#ffe4ec", "#ffd6e7"], text: "#ad1457" },
    { id: "forest", name: "森林绿", emoji: "🌿", bg: ["#e8f5e9", "#c8e6c9", "#a5d6a7"], text: "#1b5e20" },
  ];

  function wrapText(ctx, text, maxWidth) {
    const paragraphs = text.split("\n");
    const lines = [];
    for (const para of paragraphs) {
      if (!para.trim()) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const char of para) {
        const test = line + char;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = char;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  function drawGradientBg(ctx, w, h, colors) {
    const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.5, colors[1]);
    g.addColorStop(1, colors[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawDecorations(ctx, w, h, styleId) {
    ctx.save();
    if (styleId === "watercolor") {
      for (let i = 0; i < 6; i++) {
        ctx.globalAlpha = 0.08 + Math.random() * 0.06;
        ctx.fillStyle = `hsl(${20 + i * 30}, 70%, 75%)`;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 80 + Math.random() * 120, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (styleId === "neon") {
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = "#e040fb";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(0, h * (0.2 + i * 0.15));
        ctx.lineTo(w, h * (0.25 + i * 0.15));
        ctx.stroke();
      }
    } else if (styleId === "retro") {
      ctx.globalAlpha = 0.12;
      for (let y = 0; y < h; y += 4) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, y, w, 2);
      }
    } else if (styleId === "sakura") {
      ctx.globalAlpha = 0.2;
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = "#f48fb1";
        const x = Math.random() * w;
        const y = Math.random() * h;
        ctx.beginPath();
        ctx.ellipse(x, y, 8, 5, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function render(canvas, { songTitle, songArtist, moodText, styleId }) {
    const style = STYLES.find((s) => s.id === styleId) || STYLES[0];
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, w, h);
    drawGradientBg(ctx, w, h, style.bg);
    drawDecorations(ctx, w, h, styleId);

    const pad = 60;
    const textColor = style.text;

    // 顶部装饰线
    ctx.strokeStyle = textColor;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, 80);
    ctx.lineTo(w - pad, 80);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 歌曲名
    ctx.fillStyle = textColor;
    ctx.font = "bold 48px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`《${songTitle}》`, w / 2, 160);

    ctx.font = "28px 'Noto Sans SC', sans-serif";
    ctx.globalAlpha = 0.7;
    ctx.fillText(songArtist, w / 2, 210);
    ctx.globalAlpha = 1;

    // 分隔
    ctx.font = "36px serif";
    ctx.globalAlpha = 0.4;
    ctx.fillText("♪", w / 2, 280);
    ctx.globalAlpha = 1;

    // 心情文案
    ctx.font = "32px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "left";
    const lines = wrapText(ctx, moodText, w - pad * 2);
    let y = 340;
    const lineHeight = 52;
    for (const line of lines) {
      if (y > h - 120) break;
      ctx.fillStyle = textColor;
      ctx.fillText(line, pad, y);
      y += lineHeight;
    }

    // 底部水印
    ctx.textAlign = "center";
    ctx.font = "22px 'Noto Sans SC', sans-serif";
    ctx.globalAlpha = 0.45;
    ctx.fillText("哼歌助手 · 分享心情", w / 2, h - 50);
    ctx.globalAlpha = 1;

    return canvas;
  }

  async function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function copyToClipboard(canvas) {
    const blob = await canvasToBlob(canvas);
    if (!blob) throw new Error("无法生成图片");

    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return true;
    } catch {
      return false;
    }
  }

  function download(canvas, filename = "哼歌心情.png") {
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return { STYLES, render, copyToClipboard, download };
})();
