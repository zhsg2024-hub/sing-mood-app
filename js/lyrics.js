/**
 * LRC 歌词解析与 KTV 节拍同步引擎
 * - 逐字/逐词滚唱高亮
 * - BPM 节拍网格对齐
 * - 节拍指示器
 */
const LyricsEngine = (() => {
  const regex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\](.*)/;

  function parseLrc(lrcText) {
    const lines = [];
    for (const raw of lrcText.split("\n")) {
      const m = raw.match(regex);
      if (!m) continue;
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const ms = parseInt(m[3].padEnd(3, "0").slice(0, 3), 10);
      const time = min * 60 + sec + ms / 1000;
      const text = m[4].trim();
      if (text) lines.push({ time, text });
    }
    lines.sort((a, b) => a.time - b.time);
    return lines;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  /** 分词：中文逐字，英文整词，标点/空格权重更低 */
  function tokenize(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (/\s/.test(ch)) {
        tokens.push({ text: ch, weight: 0.12 });
        i++;
      } else if (/[a-zA-Z]/.test(ch)) {
        let word = ch;
        i++;
        while (i < text.length && /[a-zA-Z']/.test(text[i])) word += text[i++];
        tokens.push({ text: word, weight: Math.max(0.8, word.length * 0.45) });
      } else if (/[，。！？、；：,.!?\-]/.test(ch)) {
        tokens.push({ text: ch, weight: 0.2 });
        i++;
      } else {
        tokens.push({ text: ch, weight: 1 });
        i++;
      }
    }
    return tokens;
  }

  function snapToGrid(time, grid) {
    if (grid <= 0) return time;
    return Math.round(time / grid) * grid;
  }

  /** 为每行生成逐字时间轴，并对齐 BPM 节拍 */
  function buildBeatTimeline(lines, bpm = 72) {
    const beatDur = 60 / bpm;
    const grid = beatDur / 2; // 八分音符网格

    return lines.map((line, i) => {
      const nextStart = i < lines.length - 1 ? lines[i + 1].time : null;
      const endTime = nextStart != null
        ? Math.max(line.time + grid, nextStart - 0.06)
        : line.time + Math.max(2.5, line.text.length * 0.32);

      const tokens = tokenize(line.text);
      const totalWeight = tokens.reduce((s, t) => s + t.weight, 0) || 1;
      const span = endTime - line.time;

      let cursor = line.time;
      const syllables = tokens.map((tok, ti) => {
        const portion = (tok.weight / totalWeight) * span;
        let start = snapToGrid(cursor, grid);
        cursor += portion;
        let end = snapToGrid(cursor, grid);
        if (end <= start) end = start + grid * 0.5;
        if (ti === tokens.length - 1) end = endTime;
        return { text: tok.text, start, end };
      });

      return { ...line, endTime, syllables, bpm, beatDur };
    });
  }

  class KaraokePlayer {
    constructor(containerEl, lines, options = {}) {
      this.container = containerEl;
      this.bpm = options.bpm || 72;
      this.beatDur = 60 / this.bpm;
      this.lines = buildBeatTimeline(lines, this.bpm);
      this.duration = this.lines.length
        ? this.lines[this.lines.length - 1].endTime + 4
        : 60;
      this.currentTime = 0;
      this.playing = false;
      this.rafId = null;
      this.startTimestamp = 0;
      this.onTimeUpdate = null;
      this.onEnd = null;
      this.onBeat = null;
      this.activeIndex = -1;
      this.lastBeatIndex = -1;
      this.charEls = [];
      this.render();
    }

    render() {
      this.container.innerHTML = "";
      this.lineEls = [];
      this.charEls = [];

      this.lines.forEach((line, li) => {
        const row = document.createElement("div");
        row.className = "lyrics-line";
        row.dataset.index = li;

        const dual = document.createElement("div");
        dual.className = "ktv-dual";

        const charRow = document.createElement("div");
        charRow.className = "ktv-chars";
        const lineChars = [];

        line.syllables.forEach((syll, si) => {
          const span = document.createElement("span");
          span.className = "ktv-char";
          span.textContent = syll.text;
          span.dataset.line = li;
          span.dataset.char = si;
          charRow.appendChild(span);
          lineChars.push(span);
        });

        const sweep = document.createElement("div");
        sweep.className = "ktv-sweep";

        dual.appendChild(charRow);
        dual.appendChild(sweep);
        row.appendChild(dual);
        this.container.appendChild(row);
        this.lineEls.push(row);
        this.charEls.push(lineChars);
      });
    }

    getActiveIndex(time) {
      let idx = -1;
      for (let i = 0; i < this.lines.length; i++) {
        if (this.lines[i].time <= time) idx = i;
        else break;
      }
      return idx;
    }

    getLineProgress(line, time) {
      if (time < line.time) return 0;
      if (time >= line.endTime) return 1;
      const { syllables } = line;
      if (!syllables.length) return 0;

      for (let i = 0; i < syllables.length; i++) {
        const s = syllables[i];
        if (time >= s.start && time < s.end) {
          const local = (time - s.start) / Math.max(0.001, s.end - s.start);
          return (i + local) / syllables.length;
        }
        if (time < s.start) return i / syllables.length;
      }
      return 1;
    }

    updateFrame() {
      const time = this.currentTime;
      const idx = this.getActiveIndex(time);
      const beatIndex = Math.floor(time / this.beatDur);

      if (beatIndex !== this.lastBeatIndex) {
        this.lastBeatIndex = beatIndex;
        this.onBeat?.(beatIndex % 4, this.bpm);
      }

      if (idx !== this.activeIndex) {
        this.activeIndex = idx;
        this.lineEls.forEach((el, i) => {
          el.classList.remove("active", "upcoming", "past");
          if (i === idx) {
            el.classList.add("active");
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          } else if (i === idx + 1) {
            el.classList.add("upcoming");
          } else if (i < idx) {
            el.classList.add("past");
          }
        });
      }

      this.lineEls.forEach((row, li) => {
        const line = this.lines[li];
        const sweep = row.querySelector(".ktv-sweep");
        const chars = this.charEls[li];
        if (!chars) return;

        if (li < idx) {
          if (sweep) sweep.style.setProperty("--fill", "100%");
          chars.forEach((c) => { c.className = "ktv-char sung"; });
          return;
        }
        if (li > idx) {
          if (sweep) sweep.style.setProperty("--fill", "0%");
          chars.forEach((c) => { c.className = "ktv-char"; });
          return;
        }

        const progress = this.getLineProgress(line, time);
        if (sweep) sweep.style.setProperty("--fill", `${(progress * 100).toFixed(2)}%`);

        line.syllables.forEach((syll, si) => {
          const el = chars[si];
          if (!el) return;
          el.classList.remove("sung", "singing", "beat-pop");
          if (time >= syll.end) {
            el.classList.add("sung");
          } else if (time >= syll.start) {
            el.classList.add("singing");
            const posInSyll = (time - syll.start) / Math.max(0.001, syll.end - syll.start);
            if (posInSyll < 0.4) el.classList.add("beat-pop");
          }
        });
      });
    }

    tick = () => {
      if (!this.playing) return;
      this.currentTime = (performance.now() - this.startTimestamp) / 1000;
      if (this.currentTime >= this.duration) {
        this.pause();
        this.onEnd?.();
        return;
      }
      this.updateFrame();
      this.onTimeUpdate?.(this.currentTime, this.duration);
      this.rafId = requestAnimationFrame(this.tick);
    };

    play(fromTime = 0) {
      this.pause();
      this.currentTime = fromTime;
      this.playing = true;
      this.lastBeatIndex = Math.floor(fromTime / this.beatDur) - 1;
      this.startTimestamp = performance.now() - fromTime * 1000;
      this.updateFrame();
      this.rafId = requestAnimationFrame(this.tick);
    }

    pause() {
      this.playing = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
    }

    seek(time) {
      const wasPlaying = this.playing;
      this.pause();
      this.currentTime = Math.max(0, Math.min(time, this.duration));
      this.lastBeatIndex = Math.floor(this.currentTime / this.beatDur) - 1;
      this.updateFrame();
      this.onTimeUpdate?.(this.currentTime, this.duration);
      if (wasPlaying) this.play(this.currentTime);
    }

    reset() {
      this.pause();
      this.currentTime = 0;
      this.activeIndex = -1;
      this.lastBeatIndex = -1;
      this.lineEls.forEach((row) => {
        row.classList.remove("active", "upcoming", "past");
        row.querySelector(".ktv-sweep")?.style.setProperty("--fill", "0%");
      });
      this.charEls.forEach((chars) => {
        chars.forEach((c) => { c.className = "ktv-char"; });
      });
      this.onTimeUpdate?.(0, this.duration);
    }
  }

  /** 初始化节拍指示点（4/4 拍） */
  function initBeatBar(containerEl) {
    containerEl.innerHTML = "";
    const dots = [];
    for (let i = 0; i < 4; i++) {
      const dot = document.createElement("span");
      dot.className = "beat-dot";
      dot.dataset.beat = i;
      containerEl.appendChild(dot);
      dots.push(dot);
    }
    return {
      pulse(beatInBar) {
        dots.forEach((d, i) => {
          d.classList.toggle("active", i === beatInBar);
          d.classList.toggle("downbeat", i === 0 && beatInBar === 0);
        });
      },
      reset() {
        dots.forEach((d) => d.classList.remove("active", "downbeat"));
      },
    };
  }

  return { parseLrc, formatTime, buildBeatTimeline, KaraokePlayer, initBeatBar };
})();
