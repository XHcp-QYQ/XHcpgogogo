<<<<<<< HEAD
# INP Playwright 主流程自动化测试项目

基于桌面文件 `INP-playwright脚本.txt` 中录制的 Playwright 脚本整理而成，并参考 `D:\AI\e2e-testing` 的项目组织方式拆分为配置、Page Object、测试用例和工具配置。

## 项目结构

```text
INP-autotest/
├── .env.example                  # 环境变量模板
├── .gitignore
├── package.json                  # npm 脚本与依赖
├── playwright.config.js          # Playwright 全局配置
├── pages/                        # Page Object 层
│   ├── LoginPage.js
│   ├── PurchasePage.js
│   ├── CartPage.js
│   └── OrderPage.js
├── tests/specs/
│   └── inp-mainflow.spec.js      # INP 主流程测试
├── utils/
│   └── env.js                    # 环境变量读取
├── reports/
└── workbuddy-test-results/       # 测试报告与失败截图/trace/video 输出
```

## 主流程覆盖

`INP-MAIN-001 登录-采购-加购-结算-提交订单-查看订单`

对应原始脚本流程：

1. 输入 Account/email、Password、Graphic verification code 并登录
2. 进入 Purchase
3. 勾选商品 `JKM620N-72HL4-V JKM620N-72HL4`，数量填写 `100`
4. Add to the cart
5. 打开购物车，勾选商品并 Checkout Selected items
6. 添加收货地址
7. 选择付款条件 `%DP+90%BP`
8. 选择首付款方式 `T/T`，尾款方式 `L/C`
9. 选择交付日期并提交订单
10. 进入 paySuccess 后点击 View orders

## 使用方式

### 1. 安装依赖

```bash
cd D:/AI/INP-autotest
npm install
npx playwright install chromium
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，按测试环境实际情况调整：

```bash
cp .env.example .env
```

重点配置：

| 变量 | 说明 |
| --- | --- |
| `BASE_URL` | INP 测试环境地址 |
| `TEST_ACCOUNT` / `TEST_PASSWORD` | 登录账号与密码 |
| `GRAPHIC_CODE` | 图形验证码；如果验证码会变化，运行前更新该值 |
| `PRODUCT_ROW_NAME` | 商品表格行名称 |
| `PURCHASE_QTY` | 采购数量 |
| `ADDRESS_ROW_NAME` | 收货地址行名称 |
| `PAYMENT_TERM` | 付款条件 |
| `FIRST_PAYMENT_METHOD` | 首付款方式 |
| `BALANCE_ROW_NAME` | 尾款行名称 |
| `BALANCE_PAYMENT_METHOD` | 尾款付款方式 |

### 3. 执行测试

```bash
# 跑主流程
npm run test:main

# 有界面调试
npm run test:main:headed

# Playwright 调试模式
npm run test:debug

# 查看 HTML 报告
npm run test:report
```

## 注意事项

- 原始脚本中的图形验证码是固定值 `DBVG`，真实测试环境验证码如果每次变化，需要在 `.env` 中更新 `GRAPHIC_CODE`，或后续接入验证码绕过/识别机制。
- 下单链路会改动购物车和订单数据，默认 `workers=1` 串行执行，避免同一账号并发互相影响。
- 当前项目保留了原始录制选择器，并通过 Page Object 做了分层；后续如果页面文案或表格行名称变化，优先调整 `.env` 和 `pages/` 下对应页面对象。
=======
# XHcpgogogo
>>>>>>> 6d57095436042fe2fd2ae78b14b7bc4e9e11bdfb
