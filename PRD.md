# PRD：VibeLaTeX（Vibe Latex 公式工作台）

## 1. 背景与问题

在写论文、讲义、技术文档时，LaTeX 公式常见痛点：

* 写得快但排版差：可读性、对齐、空格、环境选择不统一
* 渲染报错难定位：括号/环境/宏问题排查耗时
* 需要导出透明背景公式图（PPT/Keynote/Figma/网页）但工具繁琐
* 希望用 AI 自动“格式化、修复、重构、生成、解释”公式，减少重复劳动
* 期望界面简洁美观，所见即所得

## 2. 产品定位

**VibeLaTeX** 是一个面向公式创作的轻量工作台：
**实时渲染 + AI 辅助排版/修复/生成 + 透明导出**。
系统仅依赖你提供的 **LLM API** 即可完成核心闭环；“图片转 LaTeX”作为 **可选能力**（仅当该 LLM 支持视觉输入时启用）。
（用于测试的LLM API为：sk-cp-DwICAL3EN9vpSXoVZFDYbfUcCZadz1uo3TYCQLs-ZEPo1N0hnXceN_qTJ9Vtr93NXOOk1XJUQix_ANn6Z334lfZrLyfH4bZFRQnF-7cER3nyZ1UOAb3CdPA）

## 3. 目标（Goals）

1. 输入 LaTeX 公式即可 **实时可视化**（低延迟、错误友好）
2. 通过 LLM 实现多种 AI 功能：**格式化 / 修复 / 可读性重构 / 自然语言转公式 / 解释**
3. 一键导出 **透明背景**公式图：SVG/PNG（MVP），可扩展 PDF
4. 后端提供 **交互式配置页面**：可在线修改 API 参数、开关功能、连通性测试
5. UI 简洁好看，编辑体验接近“Vibe”。

## 4. 非目标（Non-Goals）

* 不做完整文档编辑器（仅聚焦公式级别）
* 不做多人实时协作（后续可扩展）
* 不承诺“图片转 LaTeX”在纯文本 LLM 下可用（需 Vision 或 OCR）

## 5. 目标用户与典型场景

### 用户

* 学术/学生：论文、作业、讲义
* 工程/算法：Markdown/Notion/Wiki 文档
* 教师：教学材料、题解

### 场景

* S1：写公式时边写边看效果，快速定位报错
* S2：公式能渲染但不好看，一键“格式化/对齐/拆行”
* S3：截图式素材需求，导出透明 PNG/SVG 放入 PPT/Figma
* S4：从自然语言描述生成标准 LaTeX
* S5（可选）：上传公式图片→自动转 LaTeX（仅 Vision 可用）

## 6. 产品范围与信息架构

### 页面/模块

1. **主编辑页（Editor）**

   * 左：LaTeX 编辑器
   * 右：实时预览
   * 顶部：导出 / AI / 导入（可选）/ 设置入口
   * 侧栏/抽屉：样式设置（字号、颜色、padding、背景）
2. **后端配置页（Admin/Settings）** ✅ 必须

   * 配置 LLM Provider（base_url / key / model / headers / timeout）
   * 功能开关（AI 功能、KaTeX/MathJax、Vision 能力标记等）
   * 默认风格规则（可选）
   * 连通性测试与最近错误查看（简版）

## 7. 功能需求（Functional Requirements）

### 7.1 LaTeX 输入与实时可视化（P0）

**编辑器能力**

* 语法高亮、括号匹配、撤销/重做
* 防抖渲染（建议 150–300ms）
* 支持行内/块级模式切换（UI 开关）
* 错误提示：

  * 渲染失败时显示友好错误信息
  * 尽可能定位到出错位置（光标提示/下划线）

**渲染引擎**

* 默认 KaTeX（快）
* 可选 MathJax（兼容更广）——作为设置项开关（P1）
* 支持用户宏（Macros）（P1）

### 7.2 样式控制（为导出服务）（P0）

* 字号（px/pt）、颜色（字体色）
* 背景：透明/纯色；透明状态使用棋盘格预览
* Padding（上下左右）
* 对齐（左/中/右）
* 预览缩放不影响导出；导出独立 scale（1x/2x/4x）

### 7.3 AI 功能（仅依赖 LLM API）（P0/P1）

#### Action 列表（统一入口：AI 面板）

* **Format（格式化）**（P0）：规范空格、环境、对齐结构（不改语义）
* **Fix（修复）**（P0）：当渲染报错时，结合错误信息自动修复
* **Refactor（可读性重构）**（P1）：长公式拆行、`aligned/split` 重排等
* **NL→TeX（自然语言生成）**（P1）：输入中文/英文描述生成 LaTeX
* **Explain（解释）**（P1）：输出简短解释（用于教学/注释）

#### AI 交互与可控性（P0）

* AI 输出必须可解析（建议强制 JSON）
* 支持 “预览变更”：

  * 最低要求：展示 AI 输出与原文并可一键替换
  * 进阶（P1）：diff 视图 + 分段应用

#### Fix 的关键流程（P0）

* 当前公式渲染失败 → 采集 `error_message` + 原始 latex → 发送给 LLM → 返回修复版本 → 自动再次渲染

### 7.4 导出透明背景公式图（P0）

* 格式：SVG、PNG（透明）
* 参数：

  * scale：1x/2x/4x
  * padding：0–64px
  * 背景：透明/纯色
  * 裁剪：tight（紧贴内容）/ include padding
* 导出后支持：

  * 下载文件
  * 复制 LaTeX 源码（P0）
  * 复制 SVG 文本（P1）
  * 复制 PNG 到剪贴板（浏览器支持时）（P1）

### 7.5 图片 → LaTeX（可选能力）（P2，条件启用）

> 仅当你的 LLM Provider **支持视觉输入**（Vision / multimodal）时启用该入口。
> 若仅文本 LLM：该入口显示“当前模型不支持图片识别”。

* 输入：拖拽/上传/粘贴图片（PNG/JPG/WebP）
* 输出：LaTeX（进入编辑器并渲染）
* 失败兜底：一键 “AI Fix” 尝试修复可渲染版本

### 7.6 历史与模板（P1）

* 最近公式历史（localStorage，默认 20 条）
* 收藏（star）与标签（可选）
* 常用模板：分式、矩阵、cases、aligned、积分/求和等

---

## 8. 需求优先级（MVP 范围）

### P0（MVP 必须）

* 编辑器 + 实时渲染 + 错误提示
* 样式设置（透明背景预览、padding、字号）
* 导出 SVG/PNG（透明）
* AI：Format + Fix（只接一个 LLM API）
* 后端 Admin 配置页：配置 API 参数 + 测试连通性

### P1（增强）

* Refactor / NL→TeX / Explain
* diff 视图逐段应用
* MathJax 模式
* 宏管理、模板库、历史/收藏

### P2（可选/条件）

* 图片转 LaTeX（Vision 支持才开）
* PDF 高质量导出（服务端渲染或更专业方案）

---

## 9. 关键交互与界面要求（UI/UX）

* 默认布局：左编辑器、右预览，设置面板可折叠
* 深色/浅色主题
* 空状态提供“示例公式 + 模板按钮”
* 交互反馈明确：渲染状态（成功/失败）、导出成功提示、AI 处理中状态
* 快捷键（建议）

  * `Ctrl/Cmd+Enter`：强制刷新渲染
  * `Ctrl/Cmd+S`：导出（可配置默认导出格式）
  * `Ctrl/Cmd+L`：聚焦编辑器

---

## 10. 非功能需求（NFR）

* 性能：常规长度公式输入到预览更新 < 300ms
* 稳定性：渲染失败不崩溃；错误可恢复
* 兼容：Chrome/Edge/Safari（桌面）；移动端至少可浏览与复制（P1）
* 隐私与安全：

  * 默认本地保存草稿（localStorage）
  * 调用 LLM 前明确说明“公式内容会发送到你的 LLM 服务”
  * API Key 不进入前端；仅存后端（Admin 配置）
* 可观测性（P1）：

  * 记录 AI 调用次数、导出次数、渲染失败率（匿名）
  * 错误日志可在 Admin 页面查看最近 N 条

---

## 11. 技术方案（Architecture）

### 11.1 总体架构

* **Web 前端**：编辑、渲染、导出、AI 交互
* **后端服务**：LLM 代理（统一 Action）、Admin 配置页、配置存储、健康检查

### 11.2 后端交互式配置页面（必须）

* 路由：`/admin`（或 `/settings`）
* 功能：

  * 配置：

    * `base_url`
    * `api_key`
    * `model`
    * `timeout`
    * `headers`（可选）
  * 能力标记：

    * `capabilities.vision = true/false`（手动开关 + 可做探测）
  * 默认风格：

    * `enforce_katex_compatible`（true/false）
    * `style_profile`（paper/teaching/contest…）
  * 操作：

    * “Test Connection”（发起最小请求）
    * “Save & Apply”（保存后热加载生效）
    * “View Recent Errors”（最近错误）

### 11.3 LLM Action 设计（核心）

统一接口：前端只调用一个后端入口，后端根据 action 选择 prompt 模板与输出结构。

* `format_latex`
* `fix_latex`（带 error_message）
* `refactor_latex`
* `nl_to_latex`
* `explain_latex`
* `img_to_latex`（仅 vision=true 时开放）

---

## 12. 接口需求（API Spec - 摘要）

### 12.1 获取配置（前端读能力）

* `GET /api/config`
* 返回：

  * `capabilities`（vision 等）
  * `features_enabled`
  * `default_export_options`

### 12.2 LLM 统一调用

* `POST /api/llm/action`
* Request（示例字段）：

  * `action`: string
  * `latex`: string（可选）
  * `error_message`: string（fix 时必填）
  * `instruction`: string（nl_to_latex/explain 可用）
  * `constraints`: object（如 “katex_compatible=true”）
  * `image`: base64（仅 img_to_latex 且 vision=true）
* Response（统一 JSON）：

  * `ok`: boolean
  * `latex`: string（主要输出）
  * `changes`: array（可选，用于 diff）
  * `explanation`: string（可选）
  * `raw`: any（可选，调试）

### 12.3 Admin 配置

* `GET /admin`：配置页面
* `POST /api/admin/save_config`
* `POST /api/admin/test_connection`

---

## 13. 数据与存储

* 草稿：前端 `localStorage`（用户本地）
* 后端配置：

  * Dev：`config.json`
  * Prod：环境变量或 SQLite（推荐），支持热加载
* 日志：

  * 最近 N 条错误（内存 + 可落盘）

---

## 14. 权限与安全

* Admin 页面默认需要保护（生产环境至少一层）：

  * 简单口令 / Basic Auth / 管理员登录（任选其一）
* API Key 仅存后端，不回传前端
* 限流：

  * AI 调用限速（IP 或 session）
  * 超时与重试策略（最多 1 次重试）

---

## 15. 里程碑计划（建议）

### M0：需求冻结 + 原型（1–2 天）

* 确定 UI 布局
* 确定 action 列表与统一 JSON 输出格式

### M1：编辑器 + 实时渲染（3–5 天）

* 编辑器接入
* KaTeX 渲染、防抖
* 错误提示与定位

### M2：导出（2–4 天）

* SVG/PNG 导出（透明）
* padding、scale、裁剪

### M3：LLM Action（3–6 天）

* 后端 action 路由 + prompt 模板
* 前端 AI 面板（Format + Fix）
* Fix 流程闭环（带 error_message）

### M4：Admin 配置页（2–4 天）✅ 必须

* 配置保存与热加载
* Test Connection
* 功能开关（vision 标记等）

### M5：打磨与发布（3–5 天）

* 主题、模板、历史（可选）
* 基础测试与错误处理

---

## 16. 风险与对策

1. **KaTeX 兼容性不足**

   * 提供 MathJax 模式（P1）
   * AI 输出可加约束：katex-compatible
2. **AI 改变语义**

   * 强约束 prompt（“不改语义”）
   * 提供 diff/变更说明（P1）
3. **仅文本 LLM 无法做图片转公式**

   * 功能做成条件启用（vision=true 才开放）
4. **导出 PNG 字体/尺寸不一致**

   * 推荐 SVG 为主
   * PNG 采用固定渲染流程与一致字体策略

---

## 17. 验收标准（MVP）

* 实时渲染：输入常见公式（分式/矩阵/对齐）预览更新 < 300ms
* 错误提示：故意输入错误括号/环境，能提示并可继续编辑
* 导出：PNG/SVG 透明底可在 PPT/Keynote/Figma 正常叠加无白底
* AI Format：对同一公式输出稳定且可直接渲染
* AI Fix：对至少 10 个常见渲染错误样例，修复成功率 ≥ 80%
* Admin 配置页：

  * 能修改 base_url/key/model 并保存生效
  * Test Connection 可判断可用/不可用并给出错误信息
