# VibeLaTeX

VibeLaTeX is a formula workspace for real-time LaTeX rendering, AI-assisted editing, templates/history, and transparent export.

VibeLaTeX 是一个面向公式创作的工作台，支持实时 LaTeX 渲染、AI 辅助编辑、模板与历史记录，以及透明导出。

Last updated: 2026-03-10

- [中文](#中文)
- [English](#english)

## 中文

### 项目简介

VibeLaTeX 适合用来写公式、改公式、解释公式、以及把公式导出成适合文档和演示的素材。

当前已经支持：

- 实时渲染：KaTeX 默认，MathJax 可选
- AI Assistant：`Format`、`Fix`、`Refactor`、`NL -> LaTeX`、`Explain`、`Image -> LaTeX`
- 工作台切换：中文/English、深色/浅色、块级/行内
- 导出与复制：`SVG`、`PNG`、`PDF`，以及复制 `LaTeX/SVG/PNG`
- 管理后台：模型配置、功能开关、连接测试、错误与指标查看

### 环境要求

- Node.js `20+`，推荐 `24.x`
- npm

检查版本：

```bash
node -v
npm -v
```

### 一键启动

macOS：

- 双击根目录下的 `start_vibelatex.command`

Windows：

- 双击根目录下的 `start_vibelatex_windows.bat`

两个脚本都会自动完成以下事情：

- 检查 Node.js / npm 是否已安装
- 在需要时执行 `npm install`
- 自动寻找 `3000` 到 `3010` 的空闲端口
- 启动开发服务并打开浏览器

### 手动启动

如果你更习惯终端方式，直接运行：

```bash
npm install
npm run dev
```

默认地址：

- Editor: [http://localhost:3000](http://localhost:3000)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

如果 `3000` 被占用，可以手动指定端口：

```bash
npm run dev -- --port 3001
```

### 第一次使用建议

1. 打开首页，先使用示例公式，确认编辑器和预览区都正常工作。
2. 在顶部切换 `设置`、`EN`、`深色/浅色`、`块级/行内`。
3. 在导出区试一遍 `复制 LaTeX`、`复制 SVG`、`复制 PNG`、`下载 SVG`、`下载 PNG`、`下载 PDF`。
4. 打开 AI 面板，先测试 `Fix` 或 `Format`。
5. 打开模板/历史面板，确认最近内容已经保存。

### 配置 AI

不配置模型也能使用本地编辑和渲染，但 AI 功能需要在 `/admin` 中完成配置。

建议顺序：

1. 打开 [http://localhost:3000/admin](http://localhost:3000/admin)
2. 填写 `base_url`、`api_key`、`model`
3. 点击 `Test Connection`
4. 点击 `Save & Apply`

默认 provider 配置：

- `base_url`: `https://api.openai.com/v1`
- `model`: `gpt-4.1-mini`

### Admin 访问保护

如果你希望给后台加密码，在项目根目录创建 `.env.local`：

```bash
ADMIN_PASSWORD=your_strong_password
```

保存后重启开发服务。

### 常用命令

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run start
npm run perf:sample
npm run ai-fix:benchmark
npm run ai-fix:benchmark:mock
npm run pdf:poc
```

### 配置文件与环境变量

默认文件位置：

- 配置文件：`.data/config.json`
- 指标文件：`.data/metrics.json`

常用环境变量：

- `ADMIN_PASSWORD`
- `VIBELATEX_CONFIG_PATH`
- `VIBELATEX_METRICS_PATH`
- `VIBELATEX_PDF_CHROME_PATH`
- `AI_RATE_LIMIT_MAX_REQUESTS`
- `AI_RATE_LIMIT_WINDOW_MS`

### 常见问题

#### 1. PDF 导出失败

先安装 Chromium：

```bash
npx playwright install chromium
```

如果仍然失败，设置 `VIBELATEX_PDF_CHROME_PATH` 指向本机 Chrome 或 Chromium 可执行文件。

#### 2. AI 按钮点击后没有结果

通常是 `/admin` 中的 `api_key`、`model`、`base_url` 没有配置正确。先执行 `Test Connection`。

#### 3. 复制 PNG 或 SVG 失败

浏览器未授予剪贴板权限时，应用会自动降级为下载文件，这属于预期行为。

### 项目结构

```text
src/            Next.js 页面、组件、服务端逻辑
docs/           PRD、进度、计划、报告
scripts/        性能、基准、PoC 脚本
e2e/            Playwright 端到端测试
.data/          本地配置与指标文件
```

### 延伸阅读

- 需求定义：`PRD.md`
- 当前进度：`docs/current-progress.md`
- 下一阶段计划：`docs/next-stage-plan-prd.md`
- 兼容性报告：`docs/reports/compatibility-matrix-latest.md`
- 移动回归报告：`docs/reports/mobile-regression-latest.md`
- AI Fix 基准报告：`docs/reports/ai-fix-benchmark-latest.md`
- PDF 预研：`docs/pdf-export-poc.md`

## English

### Overview

VibeLaTeX is a formula workspace for writing, fixing, explaining, and exporting math expressions.

Current capabilities:

- Real-time rendering with KaTeX by default and optional MathJax
- AI Assistant: `Format`, `Fix`, `Refactor`, `NL -> LaTeX`, `Explain`, `Image -> LaTeX`
- Workspace toggles: Chinese/English, dark/light, block/inline
- Export and copy: `SVG`, `PNG`, `PDF`, plus copy `LaTeX/SVG/PNG`
- Admin console for model configuration, feature flags, connection tests, errors, and metrics

### Requirements

- Node.js `20+`, `24.x` recommended
- npm

Check your versions:

```bash
node -v
npm -v
```

### One-click start

On macOS:

- Double-click `start_vibelatex.command`

On Windows:

- Double-click `start_vibelatex_windows.bat`

Both launchers will:

- check whether Node.js and npm are installed
- run `npm install` when needed
- find an available port between `3000` and `3010`
- start the dev server and open the browser

### Manual start

If you prefer the terminal:

```bash
npm install
npm run dev
```

Default URLs:

- Editor: [http://localhost:3000](http://localhost:3000)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

If port `3000` is already in use:

```bash
npm run dev -- --port 3001
```

### Recommended first run

1. Open the home page and try the sample formula first.
2. Switch `Settings`, `中文/EN`, `Dark/Light`, and `Block/Inline` from the top bar.
3. Try the export area: `Copy LaTeX`, `Copy SVG`, `Copy PNG`, `Download SVG`, `Download PNG`, `Download PDF`.
4. Open the AI panel and test `Fix` or `Format`.
5. Open templates/history and confirm your recent content is stored.

### AI setup

Editing and rendering work without an API key, but AI features require admin setup.

Recommended steps:

1. Open [http://localhost:3000/admin](http://localhost:3000/admin)
2. Fill in `base_url`, `api_key`, and `model`
3. Click `Test Connection`
4. Click `Save & Apply`

Default provider values:

- `base_url`: `https://api.openai.com/v1`
- `model`: `gpt-4.1-mini`

### Protecting the admin page

To require a password for `/admin`, create `.env.local` in the project root:

```bash
ADMIN_PASSWORD=your_strong_password
```

Restart the dev server after saving the file.

### Useful commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run start
npm run perf:sample
npm run ai-fix:benchmark
npm run ai-fix:benchmark:mock
npm run pdf:poc
```

### Config files and environment variables

Default file locations:

- Config file: `.data/config.json`
- Metrics file: `.data/metrics.json`

Common environment variables:

- `ADMIN_PASSWORD`
- `VIBELATEX_CONFIG_PATH`
- `VIBELATEX_METRICS_PATH`
- `VIBELATEX_PDF_CHROME_PATH`
- `AI_RATE_LIMIT_MAX_REQUESTS`
- `AI_RATE_LIMIT_WINDOW_MS`

### FAQ

#### 1. PDF export fails

Install Chromium first:

```bash
npx playwright install chromium
```

If it still fails, set `VIBELATEX_PDF_CHROME_PATH` to your local Chrome or Chromium executable.

#### 2. AI buttons do not return results

This usually means `api_key`, `model`, or `base_url` in `/admin` is not configured correctly. Run `Test Connection` first.

#### 3. Copy PNG or SVG fails

If clipboard permissions are denied, the app falls back to downloading the file. This is expected.

### Project structure

```text
src/            Next.js pages, components, and server logic
docs/           PRD, progress, plans, and reports
scripts/        benchmark, performance, and PoC scripts
e2e/            Playwright end-to-end tests
.data/          local config and metrics files
```

### Further reading

- Requirements: `PRD.md`
- Current progress: `docs/current-progress.md`
- Next stage plan: `docs/next-stage-plan-prd.md`
- Compatibility report: `docs/reports/compatibility-matrix-latest.md`
- Mobile regression report: `docs/reports/mobile-regression-latest.md`
- AI fix benchmark report: `docs/reports/ai-fix-benchmark-latest.md`
- PDF PoC: `docs/pdf-export-poc.md`
