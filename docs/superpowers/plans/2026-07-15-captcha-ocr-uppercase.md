# Captcha OCR Uppercase Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增本地 OCR 验证码模式（默认 `ocr`），识别后自动大写填入，失败回退现有 prompt/manual；不改动原有三种模式与 CI `env` 策略。

**Architecture:** 新增 `utils/captchaOcr.js`（规范化 + tesseract.js 识别）；在 `LoginPage.resolveGraphicCode` 增量增加 `ocr` 分支；`env.js` 默认改为 `ocr`；文档补充说明。`manual` / `prompt` / `env` 实现体保持原样；CI workflow 不改。

**Tech Stack:** Node.js、Playwright、`tesseract.js`、Node 内置 `node:test`（规范化单测）

## Global Constraints

- 不修改 `manual` / `prompt` / `env` 分支既有逻辑（可被 `ocr` 失败时调用，但不改其内部实现）。
- 不修改 `.github/workflows/playwright-ci.yml` 的 `CAPTCHA_MODE: env`。
- OCR 识别结果及最终填入验证码输入框的值必须为大写。
- 本地默认 `CAPTCHA_MODE=ocr`；用户未要求时不要主动 git commit（计划中的 commit 步骤跳过，改由用户确认后再提交）。

---

## File Structure

| 文件 | 职责 |
|------|------|
| `utils/captchaOcr.js` | `normalizeCaptchaText` + `recognizeCaptchaFromBase64` |
| `utils/captchaOcr.test.js` | 规范化函数单测 |
| `pages/LoginPage.js` | `resolveGraphicCode` 增加 `ocr`；`fill` 前统一 `toUpperCase` |
| `utils/env.js` | 默认 `CAPTCHA_MODE` → `ocr` |
| `.env.example` | 文档化 `ocr` |
| `README.md` | 补充 `CAPTCHA_MODE` / OCR 说明；清理文末错误 merge 残留 |
| `package.json` | 增加 `tesseract.js` 依赖与可选 `test:unit` 脚本 |

---

### Task 1: captchaOcr 规范化函数 + 单测

**Files:**
- Create: `utils/captchaOcr.js`
- Create: `utils/captchaOcr.test.js`
- Modify: `package.json`（仅增加 `"test:unit": "node --test utils/**/*.test.js"`）

**Interfaces:**
- Produces:
  - `normalizeCaptchaText(text: string): string` — trim、去非字母数字、大写；空输入返回 `""`
  - （本任务暂不实现 recognize；Task 2 追加）

- [ ] **Step 1: 写失败单测**

创建 `utils/captchaOcr.test.js`:

```js
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeCaptchaText } = require("./captchaOcr");

describe("normalizeCaptchaText", () => {
  test("trims and uppercases", () => {
    assert.equal(normalizeCaptchaText("  ab12  "), "AB12");
  });

  test("strips non-alphanumeric", () => {
    assert.equal(normalizeCaptchaText("a b-1_2"), "AB12");
  });

  test("empty or non-string becomes empty", () => {
    assert.equal(normalizeCaptchaText(""), "");
    assert.equal(normalizeCaptchaText(null), "");
    assert.equal(normalizeCaptchaText(undefined), "");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test utils/captchaOcr.test.js`  
Expected: FAIL（`Cannot find module './captchaOcr'` 或 `normalizeCaptchaText` 未导出）

- [ ] **Step 3: 最小实现规范化**

创建 `utils/captchaOcr.js`:

```js
function normalizeCaptchaText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

module.exports = {
  normalizeCaptchaText,
};
```

在 `package.json` 的 `scripts` 中增加：

```json
"test:unit": "node --test utils/**/*.test.js"
```

- [ ] **Step 4: 运行确认通过**

Run: `npm run test:unit`  
Expected: PASS（3 tests）

- [ ] **Step 5: Commit（跳过，除非用户明确要求）**

---

### Task 2: tesseract.js OCR 识别

**Files:**
- Modify: `utils/captchaOcr.js`
- Modify: `package.json` / `package-lock.json`（安装 `tesseract.js`）

**Interfaces:**
- Consumes: `normalizeCaptchaText`
- Produces:
  - `async recognizeCaptchaFromBase64(base64Img: string): Promise<string>`
    - 接受 `data:image/...;base64,...` 或纯 base64
    - 返回规范化后的大写字符串；识别为空则返回 `""`
    - 引擎异常则向上抛出（由 LoginPage 捕获并回退）

- [ ] **Step 1: 安装依赖**

Run: `npm install tesseract.js`  
Expected: `package.json` dependencies 出现 `tesseract.js`

- [ ] **Step 2: 实现 recognize**

更新 `utils/captchaOcr.js` 为：

```js
const Tesseract = require("tesseract.js");

function normalizeCaptchaText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function toImageSource(base64Img) {
  if (typeof base64Img !== "string" || !base64Img) {
    throw new Error("验证码图片 base64 为空");
  }
  if (base64Img.startsWith("data:image/")) {
    return base64Img;
  }
  return `data:image/png;base64,${base64Img}`;
}

async function recognizeCaptchaFromBase64(base64Img) {
  const image = toImageSource(base64Img);
  const result = await Tesseract.recognize(image, "eng", {
    logger: () => {},
  });
  return normalizeCaptchaText(result?.data?.text || "");
}

module.exports = {
  normalizeCaptchaText,
  recognizeCaptchaFromBase64,
};
```

- [ ] **Step 3: 回归单测**

Run: `npm run test:unit`  
Expected: PASS

- [ ] **Step 4: Commit（跳过，除非用户明确要求）**

---

### Task 3: LoginPage 增加 ocr 模式（不改既有分支体）

**Files:**
- Modify: `pages/LoginPage.js`

**Interfaces:**
- Consumes: `recognizeCaptchaFromBase64` from `../utils/captchaOcr`
- Produces: `resolveGraphicCode` 支持 `captchaMode=ocr`；`login` 填入前对值 `toUpperCase`

- [ ] **Step 1: 在文件顶部增加 require**

在 `pages/LoginPage.js` 现有 require 后增加：

```js
const { recognizeCaptchaFromBase64 } = require("../utils/captchaOcr");
```

- [ ] **Step 2: 扩展 `resolveGraphicCode`（仅在 env 分支之后、prompt 之前插入 ocr；或在 prompt 之前）**

在 `resolveGraphicCode` 里，`env` 处理之后、`prompt` 之前插入：

```js
    if (normalizedMode === "ocr") {
      try {
        const base64Img = this.latestCaptcha?.base64Img;
        if (base64Img) {
          const recognized = await recognizeCaptchaFromBase64(base64Img);
          if (recognized) {
            return recognized;
          }
        }
        console.warn("OCR 未能识别图形验证码，回退到人工输入模式。");
      } catch (error) {
        console.warn(`OCR 识别失败，回退到人工输入模式：${error.message}`);
      }

      if (process.stdin.isTTY) {
        return this.promptForCaptcha({ timeoutMs: captchaPromptTimeoutMs });
      }

      this.saveCaptchaImage();
      await expect(this.graphicCodeInput).toHaveValue(/\S{4,}/, {
        timeout: captchaPromptTimeoutMs,
      });
      return this.graphicCodeInput.inputValue();
    }
```

**禁止**修改现有 `if (normalizedMode === "env")` / `"prompt"` / `"manual"` 分支内部语句。  
OCR 回退复制调用现有 API（`promptForCaptcha`、`saveCaptchaImage`、`toHaveValue`），不改为调用 `resolveGraphicCode` 递归，以免改动既有 mode 含义。

完整 `resolveGraphicCode` 目标结构：

```js
  async resolveGraphicCode({ graphicCode, captchaMode = "prompt", captchaPromptTimeoutMs } = {}) {
    const normalizedMode = String(captchaMode || "prompt").toLowerCase();

    if (normalizedMode === "env") {
      // 保持原样
      if (!graphicCode) {
        throw new Error("CAPTCHA_MODE=env 时必须配置 GRAPHIC_CODE。验证码每次变化，建议改用 CAPTCHA_MODE=prompt。 ");
      }
      return graphicCode;
    }

    if (normalizedMode === "ocr") {
      // 见上文新增块
    }

    if (normalizedMode === "prompt") {
      // 保持原样
      return this.promptForCaptcha({ timeoutMs: captchaPromptTimeoutMs });
    }

    if (normalizedMode === "manual") {
      // 保持原样
      this.saveCaptchaImage();
      await expect(this.graphicCodeInput).toHaveValue(/\S{4,}/, {
        timeout: captchaPromptTimeoutMs,
      });
      return this.graphicCodeInput.inputValue();
    }

    if (graphicCode) {
      return graphicCode;
    }

    throw new Error(`不支持的 CAPTCHA_MODE：${captchaMode}`);
  }
```

- [ ] **Step 3: `login` 中 fill 前统一大写（不改取码逻辑）**

将：

```js
      await this.graphicCodeInput.fill(resolvedGraphicCode);
```

改为：

```js
      const uppercaseGraphicCode = String(resolvedGraphicCode || "").trim().toUpperCase();
      await this.graphicCodeInput.fill(uppercaseGraphicCode);
```

- [ ] **Step 4: `login` 重试次数包含 ocr**

将：

```js
    const maxAttempts = ["manual", "prompt"].includes(normalizedMode) ? 3 : 1;
```

改为：

```js
    const maxAttempts = ["manual", "prompt", "ocr"].includes(normalizedMode) ? 3 : 1;
```

说明：仅扩展数组成员，不改重试循环体逻辑。

- [ ] **Step 5: Commit（跳过，除非用户明确要求）**

---

### Task 4: 默认配置与文档

**Files:**
- Modify: `utils/env.js`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: 默认 `CAPTCHA_MODE=ocr`；文档说明四种模式；CI 文档仍指向 env

- [ ] **Step 1: 改默认值**

`utils/env.js`：

```js
  CAPTCHA_MODE: getEnv("CAPTCHA_MODE", "ocr"),
```

- [ ] **Step 2: 更新 `.env.example`**

将验证码相关注释与默认改为：

```env
# 图形验证码每次进入登录页都会变化
# ocr：本地 tesseract 自动识别后按大写填入；失败回退 prompt（TTY）或 manual（非 TTY）
# manual：打开有头浏览器后由人工在页面中输入验证码，脚本检测到输入后自动点击登录
# prompt：脚本保存验证码图片并在交互式终端中提示输入；非交互运行会失败并给出图片路径
# env：仅用于验证码固定的特殊环境，读取 GRAPHIC_CODE（CI 使用）
CAPTCHA_MODE=ocr
CAPTCHA_PROMPT_TIMEOUT_MS=120000
GRAPHIC_CODE=
```

- [ ] **Step 3: 更新 README 验证码说明**

在「重点配置」表格中增加或更新 `CAPTCHA_MODE` 行，并更新注意事项中关于验证码的段落，例如：

- `CAPTCHA_MODE`：`ocr`（默认，本地自动识别并大写）/ `manual` / `prompt` / `env`（CI）
- 注意事项改为：默认 `ocr` 自动识别；识别失败会回退人工；CI 使用 `env` + `GRAPHIC_CODE`

同时删除 `README.md` 文末错误的 merge 冲突残留（约 `=======` / `# XHcpgogogo` / `>>>>>>> ...` 三行），保留冲突前有效内容结尾。

- [ ] **Step 4: 确认 CI 未改**

Run: 打开 `.github/workflows/playwright-ci.yml`，确认仍为：

```yaml
CAPTCHA_MODE: env
```

勿修改该文件。

- [ ] **Step 5: Commit（跳过，除非用户明确要求）**

---

### Task 5: 验证

**Files:** 无新增

- [ ] **Step 1: 跑单元测试**

Run: `npm run test:unit`  
Expected: 全部 PASS

- [ ] **Step 2: 静态检查 LoginPage 导出与语法**

Run: `node -e "require('./pages/LoginPage'); require('./utils/captchaOcr'); console.log('ok')"`  
Expected: 打印 `ok`

- [ ] **Step 3:（可选）本地有环境时冒烟登录**

Run: `npm run test:main:headed`（需可用测试账号与网络）  
Expected: 登录阶段若 OCR 成功则自动大写填入；失败则按回退路径可继续。

- [ ] **Step 4: 完成说明**

向用户汇报：改动文件列表、默认模式、回退行为、CI 未动；询问是否需要提交 commit。

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|-----------|------|
| `utils/captchaOcr.js` + tesseract | Task 1–2 |
| `resolveGraphicCode` 增加 ocr、失败回退 | Task 3 |
| 识别/填入大写 | Task 1–3 |
| 默认 CAPTCHA_MODE=ocr | Task 4 |
| 文档 / .env.example | Task 4 |
| 不改 CI env | Task 4 Step 4 |
| 不改 manual/prompt/env 分支体 | Task 3 明确约束 |
| 重试包含 ocr | Task 3 Step 4 |

## Self-Review Notes

- 无 TBD/占位步骤。
- `recognizeCaptchaFromBase64` / `normalizeCaptchaText` 命名在 Task 1–3 一致。
- OCR 回退故意内联调用既有 API，避免递归改写 `resolveGraphicCode` 语义。
