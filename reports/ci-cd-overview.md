# CI/CD 流水线交付说明

## 已完成

- 已在当前项目 `D:/AI/INP-autotest` 初始化 Git 仓库。
- 已创建并提交 GitHub Actions 工作流：`.github/workflows/playwright-ci.yml`。
- 已将默认分支设置为 `main`。
- 已完成 2 次本地 Git 提交：
  - `846cfc5 Add Playwright CI pipeline`
  - `7f78597 Add Playwright report deployment`

## CI/CD 能力

工作流名称：`Playwright CI/CD`

触发方式：
- push 到 `main` / `master`
- pull request 到 `main` / `master`
- GitHub Actions 页面手动触发

流水线步骤：
1. 拉取代码
2. 安装 Node.js 22
3. 执行 `npm ci`
4. 安装 Playwright Chromium 浏览器及依赖
5. 执行 `npx playwright test`
6. 上传测试产物
7. 非 PR 场景下部署 Playwright HTML 报告到 GitHub Pages

## 需要你在 GitHub 仓库中配置的 Secrets

进入仓库：Settings → Secrets and variables → Actions → New repository secret

建议配置：

- `BASE_URL`
- `INP_ACCOUNT`
- `INP_PASSWORD`
- `GRAPHIC_CODE`
- `PRODUCT_ROW_NAME`
- `PURCHASE_QTY`
- `PAYMENT_TERM`
- `PAYMENT_METHOD`
- `BALANCE_ROW_NAME`

注意：当前 CI 环境使用 `CAPTCHA_MODE=env`，如果线上验证码每次动态变化且不能固定，CI 登录会受到验证码限制。

## 下一步

当前环境无法直接操作你电脑 Chrome 中的 GitHub 页面，也没有 GitHub CLI，因此远程仓库还未创建/推送。

你可以先在 GitHub Chrome 页面创建空仓库：`XHcpgogogo`。

创建后把仓库地址发我，我会继续执行：

```bash
git remote add origin <你的仓库地址>
git push -u origin main
```

如果你安装并登录 GitHub CLI，也可以让我继续自动创建：

```bash
gh repo create XHcpgogogo --private --source D:/AI/INP-autotest --remote origin --push
```
