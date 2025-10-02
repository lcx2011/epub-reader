# 简阅 · EPUB (前端静态站点)

一个简洁、专业、接近苹果图书风格的 Web EPUB 阅读器。只用前端（React + Vite + Bootstrap + epub.js）。

## 使用

1. 安装依赖并启动开发服务器：

```bash
npm install
npm run dev
```

2. 放书：将 `.epub` 文件放入 `public/epubs/` 目录，并在 `public/epubs/index.json` 中登记，例如：

```json
[
  { "slug": "my-book", "title": "我的小说", "author": "作者", "file": "my-book.epub" }
]
```

3. 打开首页即可看到书架，点击进入阅读。

## 构建

```bash
npm run build
npm run preview
```

## 注意
- 本项目只前端静态文件，可直接部署到静态网站（Netlify、GitHub Pages 等）。
- 书籍不会上传到任何服务器，均位于 `public/epubs/` 本地/站点目录中。
- 如需封面、书签、进度同步等进一步功能，可在现有结构上继续扩展。
