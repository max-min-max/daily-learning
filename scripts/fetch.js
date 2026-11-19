const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const config = require('./config.json');
const { summarizeTopics } = require('./ai');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const FETCH_WINDOW_HOURS = 72;
const RETAIN_DAYS = Number(process.env.RETAIN_DAYS || 30);
const HISTORY_MAX = 5000;

function beijingToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return { links: [] };
  }
}

function withinWindow(dateStr) {
  if (!dateStr) return true;
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts <= FETCH_WINDOW_HOURS * 3600 * 1000;
}

async function fetchTopic(topic, parser, seenLinks) {
  const items = [];
  for (const feedUrl of topic.feeds) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items) {
        const link = item.link;
        if (!link || seenLinks.has(link)) continue;
        if (!withinWindow(item.isoDate || item.pubDate)) continue;
        const title = (item.title || '').trim();
        if (!title) continue;
        const haystack = (title + ' ' + (item.contentSnippet || '')).toLowerCase();
        const matched = topic.keywords.some((k) => haystack.includes(k.toLowerCase()));
        if (!matched) continue;
        items.push({
          title,
          link,
          source: feed.title || feedUrl,
          date: item.isoDate || item.pubDate || '',
          snippet: (item.contentSnippet || '').trim().slice(0, 200)
        });
      }
    } catch (e) {
      console.error(`订阅源抓取失败 ${feedUrl}: ${e.message}`);
    }
  }
  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return items.slice(0, topic.maxItems || 20);
}

function listDates() {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace('.json', ''))
    .sort()
    .reverse();
}

function pruneOldFiles(today) {
  const cutoff = new Date(`${today}T00:00:00+08:00`).getTime() - RETAIN_DAYS * 86400 * 1000;
  for (const date of listDates()) {
    if (date === today) continue;
    if (new Date(`${date}T00:00:00+08:00`).getTime() < cutoff) {
      fs.unlinkSync(path.join(DATA_DIR, `${date}.json`));
      console.log(`清理过期数据: ${date}.json`);
    }
  }
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const parser = new Parser({ timeout: 20000 });
  const history = loadHistory();
  const seen = new Set(history.links);

  const topics = [];
  for (const topic of config.topics) {
    const items = await fetchTopic(topic, parser, seen);
    topics.push({ name: topic.name, items });
    for (const item of items) seen.add(item.link);
    console.log(`主题「${topic.name}」: 抓到 ${items.length} 条`);
  }

  const withSummaries = await summarizeTopics(topics);

  const today = beijingToday();
  const digest = {
    date: today,
    generatedAt: new Date().toISOString(),
    topics: withSummaries,
    dates: null
  };

  fs.writeFileSync(path.join(DATA_DIR, `${today}.json`), JSON.stringify(digest, null, 2));
  pruneOldFiles(today);
  digest.dates = listDates();
  fs.writeFileSync(path.join(DATA_DIR, 'latest.json'), JSON.stringify(digest, null, 2));

  history.links = Array.from(seen).slice(-HISTORY_MAX);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log(`完成，已生成 ${today}.json 与 latest.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
