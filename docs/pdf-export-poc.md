# PDF Export PoC (N+1)

## 目标

验证 VibeLaTeX 在不引入服务端渲染依赖的前提下，是否可稳定输出可分享 PDF。

## 方案对比

| 方案 | 保真度 | 性能 | 实现成本 | 结论 |
|---|---|---|---|---|
| 浏览器 `page.pdf()`（Playwright） | 高（与页面一致） | 中 | 低 | 适合作为 PoC 与自动化产物 |
| 前端 canvas/SVG 拼接转 PDF | 中 | 中 | 中 | 可做纯前端方案，但边界兼容复杂 |
| 服务端 TeX 引擎渲染后合成 | 最高 | 低-中 | 高 | 适合后期高保真生产方案 |

## 当前 PoC

- 脚本：`scripts/pdf-export-poc.mjs`
- 命令：`npm run pdf:poc`
- 默认输出：`.data/poc/formula-preview.pdf`
- 前置条件：本地已有可访问的 Web 服务（默认 `http://127.0.0.1:3006`）

可用环境变量：

- `PDF_POC_BASE_URL`：页面地址
- `PDF_POC_OUT`：输出 PDF 路径
- `PDF_POC_FORMULA`：注入公式

## 决策建议

- 短期上线路径：先以 PoC 脚本方式支持“离线批量导出/验证”。
- 正式产品路径：评估是否引入服务端渲染链路，以提高复杂公式与分页场景的稳定性。
