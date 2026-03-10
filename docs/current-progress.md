# VibeLaTeX 当前开发进度（对照 PRD）

更新日期：2026-02-24

## 1. 阶段结论

- P0 功能已完成并稳定运行。
- P1 功能已完成（含 Refactor/NL→LaTeX/Explain、MathJax、模板/宏/历史、Diff 分段应用）。
- P2 功能已完成（Image 三入口 + PDF Beta 主界面入口）。
- N+2 阶段收口项已实现：重试上限收敛、空状态+设置面板折叠、AI Fix 基准脚本与报告、兼容/移动回归报告产物。

## 2. 已交付能力（代码基线）

### 2.1 编辑器与渲染

- Monaco 编辑器、高亮、错误定位、快捷键已就绪。
- KaTeX 默认、MathJax 可选。
- 防抖渲染与失败兜底可用。

### 2.2 AI Assistant

- Action 全量接入：`format_latex`、`fix_latex`、`refactor_latex`、`nl_to_latex`、`explain_latex`、`img_to_latex`。
- 流式接口可用，终态幂等关闭已落地。
- 后端解析契约增强：支持 `<think>`/JSON/code fence/混合文本净化，`latex` 断言已加入。
- Diff 分段预览与按段应用可用。

### 2.3 Image -> LaTeX

- 上传 / 拖拽 / 粘贴三入口统一接入。
- 输入校验覆盖：类型、大小、分辨率。
- 状态机统一：`idle/uploading/processing/success/error`。
- 失败回退可用：重试、切换文本输入。
- `vision=false` 有明确引导。

### 2.4 导出与复制

- `SVG` / `PNG` 导出可用。
- `PDF Beta` 已从 PoC 进入主界面可达路径。
- 复制能力：`Copy LaTeX`、`Copy SVG`、`Copy PNG`。
- 剪贴板权限不足时自动降级下载（SVG/PNG），避免硬失败。

### 2.5 Admin 与工程侧

- Provider 配置、功能开关、连通性测试可用。
- 最近错误与匿名指标查看可用。
- AI 限流（IP + Session）与超时/重试可用。

## 3. PRD 对照矩阵（最新）

| PRD 条目 | 状态 | 说明 |
|---|---|---|
| 7.1 编辑器与实时渲染（P0） | 已完成 | 高亮、防抖、错误提示与定位、快捷键已覆盖。 |
| 7.1 MathJax / 宏管理（P1） | 已完成 | 配置可切换 MathJax，宏管理可持久化。 |
| 7.2 样式控制（P0） | 已完成 | 字号/颜色/背景/padding/对齐/缩放/trim 已可控。 |
| 7.3 AI Action 与预览变更（P0/P1） | 已完成 | 全 action + Diff 分段应用已落地。 |
| 7.4 SVG/PNG 导出与复制（P0/P1） | 已完成 | 下载 + 复制能力完整，含权限降级策略。 |
| 7.5 图片转 LaTeX（P2） | 已完成 | 上传/拖拽/粘贴三入口一致可用。 |
| 7.6 历史与模板（P1） | 已完成 | 历史、星标、标签、模板可用。 |
| 9 关键交互（主题/反馈/快捷键） | 已完成 | 空状态“示例公式 + 模板入口”与设置面板折叠均已落地。 |
| 10 非功能需求（兼容/性能/稳定） | 已完成（工程口径） | 性能达标，兼容矩阵/移动专项报告模板与执行结果已固化到 `docs/reports`。 |
| 14 安全（Admin 保护/限流/重试） | 已完成 | 重试策略已收敛到最多 1 次重试，配置/API/UI/单测一致。 |
| 17 MVP 验收标准 | 已完成（工程口径） | AI Fix 基准脚本 + 10 样例 + 成功率报告链路已落地。 |

## 4. 最新测试基线

- `npm run lint`：通过
- `npm run typecheck`：通过
- `npm test`：通过（`21 files / 78 tests`）
- `npm run test:e2e`：通过（`26 tests`）
- `npm run build`：通过
- `npm run perf:sample`：通过（平均 `34ms`，满足 `<300ms`）
- `npm run ai-fix:benchmark:mock`：通过（`10/10`，成功率 `100%`）

## 5. 本阶段新增修复（近期）

| 问题 | 修复结果 | 状态 |
|---|---|---|
| PDF 导出报 `PDF rendering failed` | 修复服务端 PDF 边距参数传递错误（pt -> px），并增强浏览器启动兜底 | 已修复 |
| 复制 SVG/PNG 报浏览器权限错误 | 增加剪贴板失败降级下载策略，不再硬失败 | 已修复 |
| 导出状态提示挤压头部按钮 | 导出状态改为工具栏独立一行显示 | 已修复 |
| PDF Beta 徽标浅色主题可读性差 | 增强 Light 主题配色对比度 | 已修复 |
| 重试策略与 PRD 不一致（可多次重试） | 配置层/API 层/Admin UI/运行时统一收敛到最多 1 次重试，并补齐测试 | 已修复 |
| 首屏缺少明确空状态引导 | 新增“Use sample formula / Jump to templates”空状态卡片 | 已修复 |
| 设置面板不可折叠 | 新增 Settings Panel 折叠/展开能力并持久化本地偏好 | 已修复 |
| `perf:sample` 依赖手动启动服务 | 脚本支持自动拉起 dev server 并在完成后自动关闭 | 已修复 |

## 6. 当前风险与说明

- Edge 实机通道在当前环境无法自动安装（`playwright install msedge` 需要 sudo 密码），兼容矩阵中保留 `PENDING` 行并需在具备权限的机器补跑。
