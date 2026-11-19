# 每日学习资料聚合

每天定时从 RSS 源抓取文章，按你配置的主题关键词过滤，可选 AI 生成中文摘要，最终在 GitHub Pages 上展示。全程免费，无需服务器。

## 功能

- 多主题自定义：在 `scripts/config.json` 中配置主题、关键词、RSS 源，任意增删
- 每天定时抓取（GitHub Actions，默认北京时间 9:00），72 小时内的新文章，按关键词匹配
- 已推送过的链接去重，不会每天重复出现
- 可选 AI 摘要：配置大模型 API 后自动给每条资料生成中文摘要；不配置也能用（显示 RSS 原有摘录）
- 历史数据保留 30 天，页面可切换日期回看

## 使用步骤

1. 在 GitHub 上新建仓库，把本项目推上去（分支名 `main`）。
2. 仓库设置 → Pages → Source 选择 **GitHub Actions**。
3. （可选）启用 AI 摘要：仓库 Settings → Secrets and variables → Actions 添加：
   - `AI_API_URL`：接口基础地址，如 `https://api.openai.com/v1`（DeepSeek、通义、Kimi 等 OpenAI 兼容接口均可）
   - `AI_API_KEY`：对应的 API Key
   - `AI_MODEL`：模型名，如 `deepseek-chat`（不填默认 `gpt-4o-mini`）
4. 在 Actions 页面手动运行一次「每日抓取学习资料」验证，之后每天自动运行。

## 本地运行

```bash
npm install
node scripts/fetch.js
```

生成的数据在 `public/data/` 下，直接用编辑器的静态服务器（如 Live Server）打开 `public/index.html` 即可预览。

## 调整

- **主题与订阅源**：改 `scripts/config.json`，`keywords` 命中标题或摘录即收录（不区分大小写）
- **抓取时间**：改 `.github/workflows/daily.yml` 里的 `cron`（注意是 UTC 时间，北京时间 = UTC + 8）
- **数据保留天数**：设置环境变量 `RETAIN_DAYS`，默认 30

> 注意：GitHub Actions 的定时调度可能有几分钟到十几分钟的延迟，属正常现象。
