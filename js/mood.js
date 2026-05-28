/**
 * 心情文案生成（本地模板 + 可选 API 扩展）
 */
const MoodGenerator = (() => {
  const OPENINGS = [
    "刚刚哼着",
    "无意间唱起了",
    "今天心情适合",
    "脑海里循环播放",
    "一个人 quietly 哼完",
  ];

  const MOODS = [
    "有点怀旧，有点温柔",
    "心里暖暖的，像被阳光晒过",
    "突然很想回到那个夏天",
    "有些旋律一响起，时间就慢了下来",
    "唱到一半竟然红了眼眶",
    "跑调了，但心情是准的",
    "歌词记不住，感觉却全对",
  ];

  const CLOSINGS = [
    "—— 有些歌，是用来想念的 🎵",
    "—— 哼歌的人，心里都有故事",
    "—— 分享给同样爱哼歌的你",
    "—— 音乐不用完美，心情真实就好",
    "—— 今天也要好好生活呀 ✨",
  ];

  const EMOJIS = ["🎤", "🎵", "✨", "🌙", "☀️", "🍃", "💫"];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generate(song, extraContext = "") {
    const { title, artist } = song;
    const opening = pick(OPENINGS);
    const mood = pick(MOODS);
    const closing = pick(CLOSINGS);
    const emoji = pick(EMOJIS);

    let text = `${emoji} ${opening}《${title}》—— ${artist}\n\n`;
    text += `${mood}。\n`;
    if (extraContext) {
      text += `\n${extraContext}\n`;
    }
    text += `\n${closing}`;

    return text;
  }

  /** 根据当前歌词行生成更贴合的文案 */
  function generateFromLyrics(song, activeLyricLine) {
    const extra = activeLyricLine ? `唱到了「${activeLyricLine}」` : "";
    return generate(song, extra);
  }

  /**
   * 优先服务端生成文案（Key 在服务器）
   */
  async function generateWithAI(song, activeLine) {
    if (ApiClient.isConfigured()) {
      try {
        const res = await fetch(`${ApiClient.getBaseUrl()}/api/mood/generate`, {
          method: "POST",
          headers: ApiClient.buildHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            title: song.title,
            artist: song.artist,
            activeLine: activeLine || "",
          }),
        });
        const data = await res.json();
        if (res.ok && data.text) return data.text;
      } catch (_) {
        /* 回退本地模板 */
      }
    }
    return generate(song, activeLine ? `唱到了「${activeLine}」` : "");
  }

  return { generate, generateFromLyrics, generateWithAI };
})();
