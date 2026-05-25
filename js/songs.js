/**
 * 示例歌曲库（含 LRC 时间轴歌词）
 * 实际产品可对接网易云/QQ音乐歌词 API 或自建数据库
 */
const SONG_DATABASE = [
  {
    id: "1",
    title: "晴天",
    artist: "周杰伦",
    lang: "zh",
    bpm: 69,
    keywords: ["晴天", "故事", "下雨天", "刮风", "教室", "花落", "铅笔", "画"],
    lrc: `[00:00.00]晴天 - 周杰伦
[00:12.00]故事的小黄花
[00:15.50]从出生那年就飘着
[00:19.00]童年的荡秋千
[00:22.50]随记忆一直晃到现在
[00:28.00]Re So So Si Do Si La
[00:31.50]So La Si Si Si Si La Si La So
[00:38.00]吹着前奏望着天空
[00:41.50]我想起花瓣试着掉落
[00:45.00]为你翘课的那一天
[00:48.50]花落的那一天
[00:52.00]教室的那一间
[00:55.50]我怎么看不见
[00:59.00]消失的下雨天
[01:02.50]我好想再淋一遍
[01:06.00]没想到失去的勇气我还留着
[01:12.00]好想再问一遍
[01:15.50]你会等待还是离开`,
  },
  {
    id: "2",
    title: "稻香",
    artist: "周杰伦",
    lang: "zh",
    bpm: 82,
    keywords: ["稻香", "回家", "乡", "河流", "童年", "纸飞机", "微笑", "梦想"],
    lrc: `[00:00.00]稻香 - 周杰伦
[00:10.00]对这个世界如果你有太多的抱怨
[00:14.00]跌倒了就不敢继续往前走
[00:17.50]为什么人要这么的脆弱 堕落
[00:24.00]请你打开电视看看
[00:27.00]多少人为生命在努力勇敢的走下去
[00:31.00]我们是不是该知足
[00:34.00]珍惜一切就算没有拥有
[00:38.00]还记得你说家是唯一的城堡
[00:42.00]随着稻香河流继续奔跑
[00:45.50]微微笑 小时候的梦我知道
[00:52.00]不要哭让萤火虫带着你逃跑
[00:56.00]乡间的歌谣永远的依靠
[00:59.50]回家吧 回到最初的美好`,
  },
  {
    id: "3",
    title: "后来",
    artist: "刘若英",
    lang: "zh",
    bpm: 72,
    keywords: ["后来", "爱", "错过", "栀子花", "白裙", "十七", "眼泪", "夏天"],
    lrc: `[00:00.00]后来 - 刘若英
[00:08.00]后来 我总算学会了
[00:12.00]如何去爱
[00:15.00]可惜你早已远去
[00:18.00]消失在人海
[00:22.00]后来 终于在眼泪中明白
[00:28.00]有些人 一旦错过就不再
[00:36.00]栀子花 白花瓣
[00:40.00]落在我蓝色百褶裙上
[00:44.00]爱你 你轻声说
[00:48.00]我低下头 闻见一阵芬芳
[00:54.00]那个永恒的夜晚
[00:58.00]十七岁仲夏 你吻我的那个夜晚
[01:04.00]让我往后的时光
[01:08.00]每当有感叹
[01:11.00]总想起当天的星光`,
  },
  {
    id: "4",
    title: "平凡之路",
    artist: "朴树",
    lang: "zh",
    bpm: 74,
    keywords: ["平凡", "之路", "徘徊", "跨过山", "人海", "曾经", "失落", "失望"],
    lrc: `[00:00.00]平凡之路 - 朴树
[00:12.00]徘徊着的 在路上的
[00:16.00]你要走吗 Via Via
[00:20.00]易碎的 骄傲着
[00:24.00]那也曾是我的模样
[00:30.00]沸腾着 不安着的
[00:34.00]你要去哪 Via Via
[00:38.00]谜一样的 沉默着的
[00:42.00]故事你真的在听吗
[00:50.00]我曾经跨过山和大海
[00:54.00]也穿过人山人海
[00:58.00]我曾经拥有着一切
[01:02.00]转眼都飘散如烟
[01:06.00]我曾经失落失望失掉所有方向
[01:14.00]直到看见平凡才是唯一的答案`,
  },
  {
    id: "5",
    title: "小幸运",
    artist: "田馥甄",
    lang: "zh",
    bpm: 85,
    keywords: ["小幸运", "青春", "相遇", "下雨", "伞", "微笑", "原来", "你"],
    lrc: `[00:00.00]小幸运 - 田馥甄
[00:10.00]我听见雨滴落在青青草地
[00:16.00]我听见远方下课钟声响起
[00:22.00]可是我没有听见你的声音
[00:28.00]认真 呼唤我姓名
[00:34.00]爱上你的时候还不懂感情
[00:40.00]离别了才觉得刻骨 铭心
[00:46.00]为什么没有发现遇见了你
[00:52.00]是生命最好的事情
[00:58.00]也许当时忙着微笑和哭泣
[01:04.00]忙着追逐天空中的流星
[01:10.00]人理所当然的忘记
[01:16.00]是谁一直在心底温暖的栖息`,
  },
  {
    id: "6",
    title: "成都",
    artist: "赵雷",
    lang: "zh",
    bpm: 65,
    keywords: ["成都", "玉林", "小酒馆", "结尾", "分别", "走到", "街头"],
    lrc: `[00:00.00]成都 - 赵雷
[00:08.00]让我掉下眼泪的
[00:12.00]不止昨夜的酒
[00:16.00]让我依依不舍的
[00:20.00]不止你的温柔
[00:24.00]余路还要走多久
[00:28.00]你握着我的手
[00:32.00]让我感到为难的
[00:36.00]是挣扎的自由
[00:44.00]分别总是在九月
[00:48.00]回忆是思念的愁
[00:52.00]深秋嫩绿的垂柳
[00:56.00]亲吻着我额头
[01:00.00]在那座阴雨的小城里
[01:04.00]我从未忘记你
[01:08.00]成都 带不走的 只有你`,
  },
  {
    id: "7",
    title: "Shape of You",
    artist: "Ed Sheeran",
    lang: "en",
    bpm: 96,
    keywords: ["shape", "you", "club", "body", "magnet", "van", "man"],
    lrc: `[00:00.00]Shape of You - Ed Sheeran
[00:08.00]The club isn't the best place to find a lover
[00:12.00]So the bar is where I go
[00:16.00]Me and my friends at the table doing shots
[00:20.00]Drinking fast and then we talk slow
[00:28.00]Come over and start up a conversation with just me
[00:32.00]And trust me I'll give it a chance now
[00:36.00]Take my hand stop put Van the Man on the jukebox
[00:40.00]And then we start to dance
[00:48.00]I'm in love with the shape of you
[00:52.00]We push and pull like a magnet do
[00:56.00]Although my heart is falling too
[01:00.00]I'm in love with your body`,
  },
  {
    id: "8",
    title: "Someone Like You",
    artist: "Adele",
    lang: "en",
    bpm: 67,
    keywords: ["someone", "like", "you", "adele", "hello", "never", "mind", "found"],
    lrc: `[00:00.00]Someone Like You - Adele
[00:10.00]I heard that you're settled down
[00:14.00]That you found a girl and you're married now
[00:18.00]I heard that your dreams came true
[00:22.00]Guess she gave you things I didn't give to you
[00:30.00]Old friend why are you so shy
[00:34.00]Ain't like you to hold back or hide from the light
[00:42.00]I hate to turn up out of the blue uninvited
[00:46.00]But I couldn't stay away I couldn't fight it
[00:54.00]Never mind I'll find someone like you
[00:62.00]I wish nothing but the best for you too
[00:70.00]Don't forget me I beg I remember you said
[00:78.00]Sometimes it lasts in love but sometimes it hurts instead`,
  },
  {
    id: "9",
    title: "Let It Go",
    artist: "Idina Menzel",
    lang: "en",
    bpm: 137,
    keywords: ["let", "go", "frozen", "snow", "queen", "cold", "free", "storm"],
    lrc: `[00:00.00]Let It Go - Idina Menzel
[00:08.00]The snow glows white on the mountain tonight
[00:12.00]Not a footprint to be seen
[00:16.00]A kingdom of isolation
[00:20.00]And it looks like I'm the queen
[00:28.00]The wind is howling like this swirling storm inside
[00:36.00]Couldn't keep it in heaven knows I tried
[00:44.00]Don't let them in don't let them see
[00:48.00]Be the good girl you always have to be
[00:56.00]Let it go let it go
[01:00.00]Can't hold it back anymore
[01:04.00]Let it go let it go
[01:08.00]Turn away and slam the door`,
  },
  {
    id: "10",
    title: "Love Story",
    artist: "Taylor Swift",
    lang: "en",
    bpm: 119,
    keywords: ["love", "story", "taylor", "romeo", "juliet", "balcony", "baby"],
    lrc: `[00:00.00]Love Story - Taylor Swift
[00:08.00]We were both young when I first saw you
[00:12.00]I close my eyes and the flashback starts
[00:16.00]I'm standing there on a balcony in summer air
[00:24.00]See the lights see the party the ball gowns
[00:28.00]See you make your way through the crowd
[00:32.00]And say hello little did I know
[00:40.00]That you were Romeo you were throwing pebbles
[00:44.00]And my daddy said stay away from Juliet
[00:52.00]And I was crying on the staircase
[00:56.00]Begging you please don't go
[01:00.00]And I said Romeo take me somewhere we can be alone
[01:08.00]I'll be waiting all that's left to do is run
[01:16.00]You'll be the prince and I'll be the princess
[01:20.00]It's a love story baby just say yes`,
  },
  {
    id: "11",
    title: "See You Again",
    artist: "Wiz Khalifa",
    lang: "en",
    bpm: 80,
    keywords: ["see", "again", "friend", "road", "fast", "furious", "charlie", "long"],
    lrc: `[00:00.00]See You Again - Wiz Khalifa
[00:10.00]It's been a long day without you my friend
[00:14.00]And I'll tell you all about it when I see you again
[00:22.00]We've come a long way from where we began
[00:26.00]Oh I'll tell you all about it when I see you again
[00:34.00]When I see you again
[00:42.00]Damn who knew all the planes we flew
[00:46.00]Good things we've been through
[00:50.00]That I'd be standing right here talking to you
[00:54.00]Bout another path I know we loved to hit the road and laugh
[01:02.00]But something told me that it wouldn't last
[01:06.00]Had to switch up look at things different see the bigger picture`,
  },
  {
    id: "12",
    title: "Yellow",
    artist: "Coldplay",
    lang: "en",
    bpm: 87,
    keywords: ["yellow", "coldplay", "stars", "look", "love", "you", "skin", "bones"],
    lrc: `[00:00.00]Yellow - Coldplay
[00:08.00]Look at the stars look how they shine for you
[00:16.00]And everything you do yeah they were all yellow
[00:24.00]I came along I wrote a song for you
[00:32.00]And all the things you do and it was called yellow
[00:40.00]So then I took my turn oh what a thing to have done
[00:48.00]And it was all yellow
[00:56.00]Your skin oh yeah your skin and bones
[01:00.00]Turn into something beautiful
[01:04.00]And you know you know I love you so
[01:08.00]You know I love you so`,
  },
  {
    id: "13",
    title: "My Heart Will Go On",
    artist: "Celine Dion",
    lang: "en",
    bpm: 97,
    keywords: ["heart", "go", "on", "titanic", "near", "far", "wherever", "love"],
    lrc: `[00:00.00]My Heart Will Go On - Celine Dion
[00:08.00]Every night in my dreams I see you I feel you
[00:16.00]That is how I know you go on
[00:24.00]Far across the distance and spaces between us
[00:32.00]You have come to show you go on
[00:40.00]Near far wherever you are
[00:44.00]I believe that the heart does go on
[00:52.00]Once more you open the door
[00:56.00]And you're here in my heart
[01:00.00]And my heart will go on and on`,
  },
  {
    id: "14",
    title: "Perfect",
    artist: "Ed Sheeran",
    lang: "en",
    bpm: 95,
    keywords: ["perfect", "dancing", "barefoot", "grass", "baby", "beautiful", "darling"],
    lrc: `[00:00.00]Perfect - Ed Sheeran
[00:08.00]I found a love for me
[00:12.00]Darling just dive right in and follow my lead
[00:20.00]Well I found a girl beautiful and sweet
[00:28.00]Oh I never knew you were the someone waiting for me
[00:36.00]Cause we were just kids when we fell in love
[00:40.00]Not knowing what it was
[00:48.00]Baby I'm dancing in the dark with you between my arms
[00:56.00]Barefoot on the grass listening to our favorite song
[01:04.00]When you said you looked a mess I whispered underneath my breath
[01:08.00]But you heard it darling you look perfect tonight`,
  },
  {
    id: "15",
    title: "Lemon",
    artist: "米津玄師",
    lang: "ja",
    bpm: 87,
    keywords: ["lemon", "レモン", "米津", "玄師", "yonezu", "夢", "優しさ", "今でも", "あなた"],
    lrc: `[00:00.00]Lemon - 米津玄師
[00:12.00]夢ならばどれほどよかっただろう
[00:18.00]未だにあなたのことを夢にみる
[00:24.00]忘れた物を取りに帰るように
[00:30.00]思い出したことをずっと忘れたくない
[00:38.00]確かにあなたの優しさを感じた
[00:44.00]愛を感じた
[00:48.00]それは確かに偽りではない
[00:54.00]本当に幸せだった
[01:00.00]私たち
[01:04.00]いつかまた会えますか
[01:10.00]今でもあなたは私の光
[01:18.00]暗闇の中 道を照らす光
[01:26.00]あなたがいなくなった世界
[01:32.00]今でも あなたは私の光`,
  },
  {
    id: "16",
    title: "Pretender",
    artist: "Official髭男dism",
    lang: "ja",
    bpm: 90,
    keywords: ["pretender", "プリテンダー", "髭男", "dism", "終わり", "バカ", "素晴らし"],
    lrc: `[00:00.00]Pretender - Official髭男dism
[00:10.00]君のその言葉にどれだけ救われたか
[00:16.00]今更もう遅いかな
[00:22.00]それでも伝えたいよ
[00:28.00]バカみたいに素晴らしい世界
[00:34.00]だけど君はいない
[00:40.00]何もないと言って
[00:46.00]でも 私は 今でも
[00:52.00]あなたのことを 思い出す
[01:00.00]I'm a pretender 偽りの hero
[01:08.00]終わりのない この story`,
  },
  {
    id: "17",
    title: "LUDA",
    artist: "米津玄師",
    lang: "ja",
    bpm: 128,
    keywords: ["luda", "ルダ", "米津", "踊れ", "dance"],
    lrc: `[00:00.00]LUDA - 米津玄師
[00:08.00]踊れ 踊れ この夜に
[00:14.00]LUDA LUDA 響くビート
[00:20.00]止まらない この気持ち
[00:26.00]心が叫んでいる
[00:32.00]もっと もっと 高く
[00:38.00]LUDA この瞬間を`,
  },
  {
    id: "18",
    title: "打上花火",
    artist: "DAOKO × 米津玄師",
    lang: "ja",
    bpm: 88,
    keywords: ["花火", "打上", "daoko", "米津", "夏", "打ち上げ"],
    lrc: `[00:00.00]打上花火 - DAOKO × 米津玄師
[00:10.00]あの日見渡した渚で
[00:16.00]君を待っていたよ
[00:22.00]あの夏 今も思い出せる
[00:28.00]花火が上がった
[00:36.00]夜に 浮かぶ 光
[00:42.00]君の 横顔 見つめていた
[00:50.00]もう一度 あの夏に戻れるなら
[00:58.00]この手を 離さないで`,
  },
];

if (typeof module !== "undefined") module.exports = { SONG_DATABASE };
