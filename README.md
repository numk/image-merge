# 截图横向排版工具

把 1~3 张竖屏截图（手机截屏，高 > 宽）合成为一张**横向透明 PNG**：高度统一为截图高度，多张并排居中，背景宽度自适应并保证至少是横向比例（默认 4:3）。这样插入文档时占用的纵向空间更小、更易阅读。

全部在浏览器本地完成（基于 Canvas），不上传任何图片，隐私安全。

## 功能

- 粘贴（`Ctrl/⌘ + V`）、拖拽、点击选择，最多 3 张
- 统一高度、并排居中、透明背景合成
- 自动补透明边距，保证输出至少为横向（最小比例可选 4:3 / 3:2 / 16:9 / 不强制）
- 可调：背景高度、图片间距、左右/上下边距
- 截图美化：圆角、阴影（模糊 + 浓度）、背景（透明 / 纯色 / 渐变，渐变可调角度）
- 缩略图可删除、左右调整顺序
- 实时预览（带透明棋盘格）
- 一键复制到剪贴板 / 下载透明 PNG

> 阴影绘制在左右/上下边距区域内，若「阴影模糊」大于边距会被画布裁切，界面会给出提示，适当调大边距即可。

## 开发

```bash
npm install
npm run dev      # 本地开发，访问终端提示的 localhost 地址
npm run build    # 产出静态文件到 dist/
npm run preview  # 预览构建产物
```

构建产物为纯静态文件，可托管到任意静态服务器或对象存储。

> 注：复制到剪贴板依赖 `ClipboardItem`，需在 `https` 或 `localhost` 环境下使用；若浏览器不支持，请改用「下载 PNG」。

## 部署到 Cloudflare Pages

Vite 默认 `base: '/'`，在 Cloudflare Pages 根路径托管无需额外配置。

### 方式 A：Dashboard Git 集成（推荐，零密钥，自动构建）

1. 将仓库推送到 GitHub / GitLab
2. Cloudflare 控制台 → Workers & Pages → Create → Pages → Connect to Git，选择该仓库
3. 构建配置：
   - Framework preset：`Vite`（或 None）
   - Build command：`npm run build`
   - Build output directory：`dist`
4. 之后每次 push 自动构建并发布

### 方式 B：Wrangler 命令行

```bash
# 首次创建项目（按提示登录）
npx wrangler login
npx wrangler pages project create image-merge

# 之后每次发布
npm run deploy   # = npm run build && wrangler pages deploy dist
```

## 技术栈

Vite + React + TypeScript，合成逻辑在 [`src/lib/compose.ts`](src/lib/compose.ts)，输入处理在 [`src/lib/usePasteImages.ts`](src/lib/usePasteImages.ts)。
