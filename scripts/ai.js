// 可选的 AI 摘要模块：配置了 AI_API_URL + AI_API_KEY 才启用，
// 否则原样返回抓取结果（使用 RSS 自带的 contentSnippet）。
// 兼容 OpenAI Chat Completions 格式（OpenAI / DeepSeek / 通义 / Kimi 等均可）。
const API_URL = process.env.AI_API_URL;
const API_KEY = process.env.AI_API_KEY;
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

function enabled() {
  return Boolean(API_URL && API_KEY);
}

async function chat(messages) {
  const res = await fetch(`${API_URL.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.3 })
  });
  if (!res.ok) {
    throw new Error(`AI 接口返回 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

function parseSummary(content) {
  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return new Map();
  try {
    const arr = JSON.parse(content.slice(start, end + 1));
    return new Map(arr.filter((x) => x && x.link && x.summary).map((x) => [x.link, String(x.summary)]));
  } catch {
    return new Map();
  }
}

async function summarizeTopics(topics) {
  if (!enabled()) {
    console.log('未配置 AI_API_URL / AI_API_KEY，跳过 AI 摘要');
    return topics;
  }
  for (const topic of topics) {
    if (!topic.items.length) continue;
    try {
      const list = topic.items.map((i) => `- ${i.title} | ${i.link}`).join('\n');
      const content = await chat([
        {
          role: 'system',
          content:
            '你是技术学习资料编辑。为每条资料写 1-2 句中文摘要，说明它讲了什么、为什么值得读。只输出 JSON 数组，不要输出其他文字。'
        },
        {
          role: 'user',
          content: `主题：${topic.name}\n资料列表：\n${list}\n\n输出格式：[{"link":"原文链接","summary":"中文摘要"}]`
        }
      ]);
      const map = parseSummary(content);
      for (const item of topic.items) {
        if (map.has(item.link)) item.summary = map.get(item.link);
      }
      console.log(`主题「${topic.name}」AI 摘要完成 ${map.size}/${topic.items.length} 条`);
    } catch (e) {
      // AI 失败不影响当天数据可用性，保留 RSS 原有摘要
      console.error(`主题「${topic.name}」AI 摘要失败，保留原文摘录: ${e.message}`);
    }
  }
  return topics;
}

module.exports = { summarizeTopics };
