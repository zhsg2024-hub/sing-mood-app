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
   * 可选：对接 OpenAI 等 API
   * 设置 window.APP_CONFIG.openaiKey 即可启用
   */
  async function generateWithAI(song, activeLine) {
    const key = window.APP_CONFIG?.openaiKey;
    if (!key) return generate(song, activeLine ? `唱到了「${activeLine}」` : "");

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
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
              content: `歌曲：《${song.title}》${song.artist}${activeLine ? `，刚唱到「${activeLine}」` : ""}`,
            },
          ],
          max_tokens: 150,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || generate(song);
    } catch {
      return generate(song);
    }
  }

  return { generate, generateFromLyrics, generateWithAI };
})();
