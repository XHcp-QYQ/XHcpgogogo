# 登录图形验证码 OCR 自动识别并大写输入

日期：2026-07-15  
状态：已定稿（待实现）

## 背景

INP 自动化登录依赖图形验证码。当前 `LoginPage` 支持：

- `manual`：有头浏览器人工在页面输入
- `prompt`：终端交互输入
- `env`：读取固定 `GRAPHIC_CODE`（CI 使用）

项目尚无本地 OCR。本地联调希望自动识别验证码，并一律按大写填入；同时不得改动原有三种模式的业务行为。

## 目标

1. 新增 `CAPTCHA_MODE=ocr`：用本地 OCR 识别接口返回的验证码图片。
2. 识别结果自动转为大写后填入「Graphic verification code」。
3. OCR 失败时回退到现有人工路径，不中断整个登录流程的可用性。
4. 本地默认改为 `ocr`；CI 继续 `CAPTCHA_MODE=env`，不改 workflow 登录策略。
5. **约束**：不修改 `manual` / `prompt` / `env` 分支既有逻辑，以及登录主循环中账号密码填充、点击登录、成功判定等行为。

## 非目标

- 不绕过服务端验证码校验。
- 不引入 Python/`ddddocr` 运行时。
- 不改变 CI 对动态验证码不可用时的 `env` 策略。
- 不重构 `LoginPage.login` 主流程结构（仅扩展解析验证码的分支）。

## 方案选择

采用独立 OCR 工具模块 + 新模式分支（方案 1）：

| 方案 | 结论 |
|------|------|
| 独立 `utils/captchaOcr.js` + `ocr` 模式 | **采用**：边界清晰，原模式不动 |
| 全部塞进 `LoginPage.js` | 不采纳：页面类过重 |
| Python `ddddocr` 子进程 | 不采纳：与 Node/Playwright 栈不统一 |

OCR 引擎：`tesseract.js`（纯 JS，无需系统安装 Tesseract）。

## 架构与数据流

```
goto/login → waitForCaptchaResponse → latestCaptcha.base64Img
    → CAPTCHA_MODE=ocr
        → captchaOcr.recognize(base64Img)
        → normalize: trim + 仅保留字母数字 + toUpperCase
        → 非空则返回给 login 填入 graphicCodeInput
        → 空/抛错 → 回退 fallbackMode
```

回退规则：

- `process.stdin.isTTY === true` → `prompt`（终端输入）
- 否则 → `manual`（等待页面人工输入）

说明：回退通过**调用现有** `promptForCaptcha` / `manual` 分支实现，不复制其实现，也不改它们的行为。

## 变更清单

### 1. `utils/captchaOcr.js`（新增）

- 输入：data URL 或 raw base64 图片。
- 输出：识别字符串（调用方负责 `toUpperCase`，或本模块统一规范化后返回大写）。
- 规范化约定：`trim()` → 去掉空白与常见干扰字符 → `toUpperCase()`；若结果长度明显不合理（如空串），视为失败。
- 失败：抛错或返回空，由 `resolveGraphicCode` 处理回退。

### 2. `pages/LoginPage.js`（增量）

在 `resolveGraphicCode` 中增加：

```text
if (normalizedMode === "ocr") {
  try recognize → if code return uppercase code
  catch/empty → fall through to prompt 或 manual（现有实现）
}
```

其余方法（`goto`、`waitForCaptchaResponse`、`saveCaptchaImage`、`promptForCaptcha`、`ensureLoginFormVisible`、`login` 主循环中 env/prompt/manual 路径）保持行为不变。  
`login` 中仅需保证传入的 `resolvedGraphicCode` 已是大写；若希望所有模式统一大写，可在 `fill` 前对 resolved 结果统一 `toUpperCase()`——**仅对最终填入值做大小写规范化，不改各模式如何取得字符串的逻辑**。推荐：OCR 路径必转大写；其它模式也在 `fill` 前统一 `toUpperCase()`，避免人工输入小写导致失败（属于输入规范化，不改变取码方式）。

### 3. `utils/env.js`

- `CAPTCHA_MODE` 默认值：`manual` → `ocr`。

### 4. `.env.example` / `README.md`

- 补充 `ocr` 模式说明与默认值。
- 明确识别后按大写输入。

### 5. `.github/workflows/playwright-ci.yml`

- **不修改** `CAPTCHA_MODE: env` 及相关 secrets。

### 6. 依赖

- 增加 `tesseract.js`（生产依赖或与现有一致放在 `dependencies`）。

## 错误处理

| 场景 | 行为 |
|------|------|
| 无 `latestCaptcha.base64Img` | OCR 失败 → 回退 prompt/manual |
| OCR 引擎异常 / 空结果 | 回退 prompt/manual，可 `console.warn` 记录原因 |
| 回退后仍登录失败（验证码错误） | 沿用现有 `login` 重试与错误抛出逻辑 |
| `CAPTCHA_MODE=env` 且无 `GRAPHIC_CODE` | 保持现有报错，不受 OCR 影响 |

## 测试建议

- 单元：对规范化函数（trim + 大写 + 去干扰）做轻量断言；OCR 可用 mock。
- 手工：本地设 `CAPTCHA_MODE=ocr` 跑主流程登录段，确认填入为大写且失败可回退。
- 回归：显式设 `manual`/`prompt`/`env`，确认行为与改前一致。

## 成功标准

1. `CAPTCHA_MODE=ocr`（默认）能自动识别并大写填入验证码。
2. OCR 失败时能回退到 prompt 或 manual。
3. `manual`/`prompt`/`env` 与 CI workflow 行为不变。
4. 未破坏登录成功判定与现有重试策略。
