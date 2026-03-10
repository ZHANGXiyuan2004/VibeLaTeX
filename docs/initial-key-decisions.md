# VibeLaTeX 项目初期关键决策记录

更新日期：2026-02-27
适用阶段：项目立项到首版 MVP（M0-M1）

## 1. 文档目的

本文件用于记录项目初期做出的关键技术与产品决策，便于后续：

- 回溯为什么这样做
- 判断哪些决策仍然有效
- 避免重复讨论已定事项

## 2. 关键决策总览（初期）

| # | 决策主题 | 初期最终决策 | 当前状态 |
|---|---|---|---|
| D1 | 交付范围 | 先完成 P0 完整 MVP，再迭代 P1/P2 | 仍有效 |
| D2 | 技术栈 | Next.js 全栈（App Router + TypeScript） | 仍有效 |
| D3 | 部署策略 | 本地单机优先（local-first） | 仍有效 |
| D4 | LLM 协议 | OpenAI Chat Completions 兼容协议 | 仍有效 |
| D5 | 编辑器方案 | Monaco（而非 CodeMirror） | 仍有效 |
| D6 | 导出方案 | 前端本地导出（SVG/PNG） | 仍有效 |
| D7 | 渲染引擎 | KaTeX 作为默认引擎，MathJax 后续补充 | 已扩展（仍保留 KaTeX 默认） |
| D8 | 配置存储 | 后端本地文件 `.data/config.json` + gitignore | 仍有效 |
| D9 | 安全基线 | 本地默认免认证，可通过 `ADMIN_PASSWORD` 开启保护 | 仍有效 |
| D10 | 测试策略 | 高覆盖优先：Vitest + Playwright | 仍有效 |
| D11 | API 设计 | 统一 LLM 入口 `/api/llm/action` + JSON 契约 | 仍有效 |
| D12 | UI 基线 | Tailwind + 轻量组件（shadcn 风格） | 仍有效 |

## 3. 决策详情（含背景与影响）

### D1. 交付范围：P0 完整 MVP 优先

- 背景：项目仓库最初几乎为空，需要尽快形成可演示闭环。
- 决策：一次性优先完成 P0 主链路（编辑、渲染、导出、AI Format/Fix、Admin）。
- 影响：
  - 优点：快速得到可用版本，验证产品价值。
  - 代价：P1（Diff 分段、模板/历史等）延后到下一阶段。

### D2. 技术栈：Next.js 全栈

- 候选：Next.js 全栈 / React+Fastify / Vue+FastAPI。
- 决策：采用 Next.js 全栈。
- 原因：
  - 前后端同仓协作成本低。
  - `/admin` 页面和 `/api/*` 接口在同一框架下实现效率更高。
- 影响：后续接口演进和页面迭代速度更快。

### D3. 部署策略：本地单机优先

- 决策：首版先服务本地使用场景，不优先云部署复杂度。
- 影响：
  - 配置落本地文件更直接。
  - 管理认证策略采用“可选开启”而非强制上线级安全方案。

### D4. LLM 协议：OpenAI Chat 兼容

- 决策：统一按 OpenAI Chat Completions 协议接入（可配 `base_url/model/headers`）。
- 影响：
  - 可兼容多家“OpenAI 兼容网关”。
  - 避免首版建立复杂多 Provider 适配层。

### D5. 编辑器：Monaco

- 候选：CodeMirror / Monaco / Textarea。
- 决策：Monaco。
- 影响：
  - 获取更成熟的编辑体验。
  - 包体积较大，但首版优先开发效率与可用性。

### D6. 导出：前端本地导出

- 候选：前端导出 / 服务端渲染导出。
- 决策：前端导出（`html-to-image`）。
- 影响：
  - 部署简单，响应快。
  - 需处理浏览器跨域样式与 dataURL 兼容细节（后续已修复）。

### D7. 渲染引擎：KaTeX 默认

- 决策：首版默认 KaTeX，MathJax 后续扩展。
- 影响：
  - 首屏渲染性能更好。
  - 对少量不兼容语法需要后续引擎切换能力补充。

### D8. 配置存储：`.data/config.json`

- 决策：配置由后端持久化到 `.data/config.json`，并加入 `.gitignore`。
- 补充：支持 `VIBELATEX_CONFIG_PATH` 覆盖路径。
- 影响：
  - 避免 API Key 进入前端返回。
  - 本地调试与迁移都更直观。

### D9. 安全策略：默认免认证 + 可开关保护

- 决策：
  - 本地默认可直接访问 Admin。
  - 设置 `ADMIN_PASSWORD` 后启用 `/admin` 与 `/api/admin/*` 保护。
- 影响：平衡本地易用性与基本安全要求。

### D10. 测试策略：Vitest + Playwright

- 决策：高覆盖优先，单元/集成用 Vitest，E2E 用 Playwright。
- 影响：
  - 接口与核心工具函数回归稳定。
  - 需要维护浏览器依赖与测试环境锁（如 `.next/dev/lock`）。

### D11. API 契约：统一 Action 接口

- 决策：所有 AI 动作走 `/api/llm/action`，以 `action` 区分。
- 统一返回：`ok / latex / changes / explanation / raw / error`。
- 影响：
  - 前端调用路径统一。
  - 后续扩展新 action（Refactor/NL->TeX/Explain）更简单。

### D12. UI 基线：Tailwind + 轻量组件

- 决策：使用 Tailwind 与轻量组件封装（按钮/输入/卡片等），不引入重型 UI 框架。
- 影响：
  - 迭代速度快、可定制性强。
  - 样式规范需要项目内持续维护。

## 4. 初期讨论后被“否决/调整”的方案

以下方案在初期讨论过，但未作为最终基线：

1. 直接把 API Key 提交到仓库配置：已否决（安全风险高）。
2. 完全无 Admin 保护策略：已调整为“默认免认证 + 可切换保护”。
3. 首版即多 Provider 深度适配：已延后，先统一 OpenAI 兼容协议。

## 5. 对后续迭代的指导意义

- 任何新功能优先评估是否破坏 D3/D8/D9（本地优先、配置安全、可切换保护）。
- 新 AI 动作优先复用 D11 契约，避免新增碎片化接口。
- 若要重构导出链路，需保持 D6 的“前端可独立工作”目标，除非明确切换部署策略。
- 若要替换编辑器或 UI 框架，需给出对 D5/D12 的收益-成本对比与迁移计划。

## 6. 相关文档

- 当前进度：`/Users/zhangxiyuan/VSCode/VibeLaTeX/docs/current-progress.md`
- 下一阶段计划：`/Users/zhangxiyuan/VSCode/VibeLaTeX/docs/next-stage-plan-prd.md`
- 产品需求：`/Users/zhangxiyuan/VSCode/VibeLaTeX/PRD.md`
