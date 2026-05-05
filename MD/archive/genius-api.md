# Genius 数据抓取避坑指南 (Cloudflare Worker 篇)

在实现 Spotify "Behind the Lyrics" 功能时，抓取 Genius 歌词及注释是最核心也最容易踩坑的环节。以下是在 Cloudflare Worker 免费版环境下总结的实战经验。

## 1. 核心架构选择：状态提取胜过 DOM 解析

不要尝试解析 HTML 节点（如 `.lyrics` 或 `.annotation`）。
- **原因**：Genius 使用 React 渲染，HTML 类名混淆且频繁变动，解析开销巨大。
- **正解**：提取 `window.__PRELOADED_STATE__`。
- **位置**：通常位于一个 `<script>` 标签内，格式为 `window.__PRELOADED_STATE__ = JSON.parse('...')`。

## 2. 性能优化：利用 HTMLRewriter 规避 10ms CPU 限制

Cloudflare 免费版限制 10ms CPU 时间。解析大型 HTML 页面必崩。
- **技巧**：使用 `HTMLRewriter` 在流式传输时拦截 `script` 标签。
- **示例**：
```javascript
let content = "";
new HTMLRewriter().on("script", {
  text(t) {
    if (t.text.includes("__PRELOADED_STATE__")) {
      content += t.text;
    }
  }
})
```

## 3. JSON 清洗：应对复杂的 JS 转义

Genius 将 JSON 序列化为单引号字符串并放入 `JSON.parse()` 中，这会导致多重转义。
- **陷阱**：直接提取出的字符串包含大量的 `\"` 和 `\\`。
- **解决**：使用正则恢复转义，注意顺序。
```javascript
const unescaped = jsonStr.replace(/\\(.)/g, (match, char) => {
  if (char === "'") return "'";
  if (char === '"') return '"';
  if (char === "\\") return "\\";
  return match;
});
```

## 4. 稳健性处理：处理脚本尾部的垃圾数据

提取出的脚本片段往往包含 `JSON.parse('...'); window.__OTHER_STATE__ = ...`。
- **现象**：`JSON.parse` 报错 "Unexpected non-whitespace character"。
- **黑科技**：捕获错误并根据错误位置截断。
```javascript
try {
  data = JSON.parse(str);
} catch (e) {
  const pos = e.message.match(/at position (\d+)/);
  if (pos) data = JSON.parse(str.substring(0, pos[1]));
}
```

## 5. 数据结构导航：实体索引系统

解析出的 JSON 结构是扁平化的（Normalised）：
- **入口**：`data.songPage.song` (仅包含当前歌曲 ID)。
- **查表**：
  - 歌曲信息：`data.entities.song[ID]`
  - 注释信息：`data.entities.annotation[ID]`
  - 歌词引用：`data.entities.referent[ID]`

## 6. 反爬虫与请求头

- **User-Agent**：必须设置真实的浏览器 UA，否则会被 Cloudflare WAF 或 Genius 屏蔽。
- **并发控制**：Worker 的 `fetch` 是并行的，但要注意不要对同一 IP 短时间发起数十次请求。

## 总结

在边缘端（Edge）抓取数据的原则是：**流式处理获取、最小化正则提取、按 ID 索引数据**。遵循这套逻辑，你可以在 0 成本的前提下实现极其强大的数据抓取引擎。
