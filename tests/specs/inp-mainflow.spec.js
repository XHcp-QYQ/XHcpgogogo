const { test, expect } = require("@playwright/test");
const { LoginPage } = require("../../pages/LoginPage");
const { PurchasePage } = require("../../pages/PurchasePage");
const { CartPage } = require("../../pages/CartPage");
const { OrderPage } = require("../../pages/OrderPage");
const {
  BASE_URL,
  ACCOUNT,
  PASSWORD,
  GRAPHIC_CODE,
  CAPTCHA_MODE,
  CAPTCHA_PROMPT_TIMEOUT_MS,
  PRODUCT_ROW_NAME,
  PURCHASE_QTY,
  ADDRESS_ROW_NAME,
  PAYMENT_TERM,
  FIRST_PAYMENT_METHOD,
  BALANCE_ROW_NAME,
  BALANCE_PAYMENT_METHOD,
  DELIVERY_DAY,
  DELIVERY_DAY_INDEX,
  ORDER_NUMBER,
} = require("../../utils/env");

test.describe("INP 主流程自动化 @inp @smoke", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180000);

  test("INP-MAIN-001 登录-采购-加购-结算-提交订单-查看订单", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const purchasePage = new PurchasePage(page);
    const cartPage = new CartPage(page);
    const orderPage = new OrderPage(page);

    await test.step("登录 INP 测试环境", async () => {
      await loginPage.goto(BASE_URL);
      await loginPage.login({
        account: ACCOUNT,
        password: PASSWORD,
        graphicCode: GRAPHIC_CODE,
        captchaMode: CAPTCHA_MODE,
        captchaPromptTimeoutMs: CAPTCHA_PROMPT_TIMEOUT_MS,
      });
      await expect(page.getByRole("link", { name: "Purchase" })).toBeVisible({ timeout: 30000 });
    });

    await test.step("进入 Purchase 并选择商品数量", async () => {
      await purchasePage.open();
      await purchasePage.selectProductAndQuantity(PRODUCT_ROW_NAME, PURCHASE_QTY);
      await purchasePage.addSelectedToCart(PURCHASE_QTY);
    });

    await test.step("进入购物车并结算选中商品", async () => {
      await cartPage.openFromHeaderIcon();
      await cartPage.selectProduct(PRODUCT_ROW_NAME);
      await cartPage.checkoutSelectedItems();
    });

    await test.step("填写订单信息并提交", async () => {
      await orderPage.chooseDeliveryAddress(ADDRESS_ROW_NAME);
      await orderPage.selectPaymentTerm(PAYMENT_TERM);
      await orderPage.selectFirstPaymentMethod(FIRST_PAYMENT_METHOD);
      await orderPage.selectBalancePaymentMethod(BALANCE_ROW_NAME, BALANCE_PAYMENT_METHOD);
      await orderPage.selectDeliveryDateByDay(DELIVERY_DAY, DELIVERY_DAY_INDEX);
      await orderPage.submitOrder();
    });

    await test.step("查看订单", async () => {
      await orderPage.openOrdersFromPaySuccess(BASE_URL);
      await expect(page).toHaveURL(/order|orders|cart|paySuccess/i, { timeout: 30000 });

      if (ORDER_NUMBER) {
        await orderPage.openOrderByNumber(ORDER_NUMBER);
      }
    });
  });
});
