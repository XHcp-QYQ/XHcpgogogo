const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const { expect } = require("@playwright/test");

class LoginPage {
  constructor(page) {
    this.page = page;
    this.memberLoginLink = page.getByRole("link", { name: "Member Login" });
    this.accountInput = page.getByRole("textbox", { name: "Account/email" });
    this.passwordInput = page.getByRole("textbox", { name: "Password" });
    this.graphicCodeInput = page.getByRole("textbox", { name: "Graphic verification code" });
    this.loginButton = page.getByRole("button", { name: "Log in" });
    this.purchaseLink = page.getByRole("link", { name: "Purchase" });
    this.latestCaptcha = null;
  }

  async goto(baseURL = "/") {
    const loginURL = new URL("/login", baseURL).toString();
    const captchaResponsePromise = this.waitForCaptchaResponse();

    await this.page.goto(loginURL, { waitUntil: "domcontentloaded" });
    await this.ensureLoginFormVisible();

    const captchaResponse = await captchaResponsePromise;
    if (captchaResponse) {
      this.latestCaptcha = captchaResponse;
    }
  }

  async waitForCaptchaResponse(timeout = 30000) {
    const response = await this.page
      .waitForResponse((res) => res.url().includes("/api/oauth/captcha"), { timeout })
      .catch(() => null);

    if (!response) {
      return null;
    }

    const body = await response.json().catch(() => null);
    const captcha = body?.data;

    if (!captcha?.base64Img) {
      return null;
    }

    return {
      captchaKey: captcha.captchaKey,
      base64Img: captcha.base64Img,
    };
  }

  saveCaptchaImage(outputDir = "workbuddy-test-results/captcha") {
    if (!this.latestCaptcha?.base64Img) {
      return null;
    }

    const matches = this.latestCaptcha.base64Img.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!matches) {
      return null;
    }

    const extension = matches[1] === "jpeg" ? "jpg" : matches[1];
    const fileName = `captcha-${Date.now()}.${extension}`;
    const absoluteOutputDir = path.resolve(process.cwd(), outputDir);
    const absoluteFilePath = path.join(absoluteOutputDir, fileName);

    fs.mkdirSync(absoluteOutputDir, { recursive: true });
    fs.writeFileSync(absoluteFilePath, Buffer.from(matches[2], "base64"));

    return path.relative(process.cwd(), absoluteFilePath).replace(/\\/g, "/");
  }

  async promptForCaptcha({ timeoutMs = 120000 } = {}) {
    const captchaImagePath = this.saveCaptchaImage();

    if (!process.stdin.isTTY) {
      throw new Error(
        [
          "INP 图形验证码每次进入登录页都会变化，当前运行环境不是交互式终端，无法输入本次验证码。",
          captchaImagePath ? `本次验证码图片已保存：${captchaImagePath}` : "未能保存本次验证码图片。",
          "请在可交互终端中运行 `npx playwright test` 并输入验证码，或临时设置 GRAPHIC_CODE 后重跑。",
        ].join("\n"),
      );
    }

    const rl = readline.createInterface({ input, output });
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`等待输入图形验证码超时：${timeoutMs}ms`)), timeoutMs);
    });

    try {
      const answer = await Promise.race([
        rl.question(
          `请输入本次图形验证码${captchaImagePath ? `（图片：${captchaImagePath}）` : ""}：`,
        ),
        timeout,
      ]);
      return answer.trim();
    } finally {
      rl.close();
    }
  }

  async resolveGraphicCode({ graphicCode, captchaMode = "prompt", captchaPromptTimeoutMs } = {}) {
    const normalizedMode = String(captchaMode || "prompt").toLowerCase();

    if (normalizedMode === "env") {
      if (!graphicCode) {
        throw new Error("CAPTCHA_MODE=env 时必须配置 GRAPHIC_CODE。验证码每次变化，建议改用 CAPTCHA_MODE=prompt。 ");
      }
      return graphicCode;
    }

    if (normalizedMode === "prompt") {
      return this.promptForCaptcha({ timeoutMs: captchaPromptTimeoutMs });
    }

    if (normalizedMode === "manual") {
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

  async ensureLoginFormVisible() {
    if (await this.accountInput.isVisible().catch(() => false)) {
      return;
    }

    if (await this.memberLoginLink.isVisible().catch(() => false)) {
      await this.memberLoginLink.click();
    }

    await expect(this.accountInput).toBeVisible({ timeout: 30000 });
  }

  async login({ account, password, graphicCode, captchaMode, captchaPromptTimeoutMs }) {
    const normalizedMode = String(captchaMode || "prompt").toLowerCase();
    const maxAttempts = ["manual", "prompt"].includes(normalizedMode) ? 3 : 1;
    let lastErrorMessage = "";

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await this.ensureLoginFormVisible();
      await this.accountInput.fill(account);
      await this.passwordInput.fill(password);

      if (attempt > 1) {
        const captchaResponsePromise = this.waitForCaptchaResponse(30000).catch(() => null);
        await this.page.reload({ waitUntil: "domcontentloaded" });
        await this.ensureLoginFormVisible();
        const captchaResponse = await captchaResponsePromise;
        if (captchaResponse) this.latestCaptcha = captchaResponse;
        await this.accountInput.fill(account);
        await this.passwordInput.fill(password);
      }

      const resolvedGraphicCode = await this.resolveGraphicCode({
        graphicCode,
        captchaMode,
        captchaPromptTimeoutMs,
      });

      await this.graphicCodeInput.fill(resolvedGraphicCode);

      const loginResponsePromise = this.page.waitForResponse(
        (response) => response.url().includes("/api/auth/login"),
        { timeout: 30000 },
      );

      await this.loginButton.click();
      const loginResponse = await loginResponsePromise;
      const loginResult = await loginResponse.json().catch(() => null);

      if (loginResult?.success) {
        await expect(this.purchaseLink).toBeVisible({ timeout: 30000 });
        return;
      }

      lastErrorMessage = loginResult?.message || `HTTP ${loginResponse.status()}`;
      const isCaptchaError = /captcha|verification code|验证码|图形验证码/i.test(lastErrorMessage);
      if (!isCaptchaError || attempt >= maxAttempts) break;
    }

    throw new Error(`INP 登录失败：${lastErrorMessage}`);
  }
}

module.exports = { LoginPage };
