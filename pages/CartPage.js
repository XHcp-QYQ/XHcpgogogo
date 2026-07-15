const { expect } = require("@playwright/test");

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class CartPage {
  constructor(page) {
    this.page = page;
    this.cartLink = page.locator("a[href='/cart']").first();
    this.checkoutSelectedButton = page.getByRole("button", { name: /Checkout Selected items/i });
    this.sureButton = page.getByRole("button", { name: "Sure" });
    this.emptyCartText = page.getByText(/shopping cart is empty/i);
  }

  productModel(rowName) {
    return String(rowName).trim().split(/\s+/)[0];
  }

  productRow(rowName) {
    const model = this.productModel(rowName);
    return this.page.getByRole("row").filter({ hasText: new RegExp(escapeRegExp(model), "i") }).first();
  }

  async getCartQuantityCount() {
    return await this.page.evaluate(async () => {
      const token = decodeURIComponent((document.cookie.match(/(?:^|;\s*)PC_TOKEN=([^;]+)/) || [])[1] || "");
      const response = await fetch("/api/bbb/userCenter/userShoppingCar/count", {
        method: "GET",
        credentials: "include",
        headers: token ? { Authorization: token } : {},
      });
      const json = await response.json().catch(() => ({}));
      const list = Array.isArray(json.data) ? json.data : [];
      return list.reduce((sum, item) => sum + Number(item.quantityCount || 0), 0);
    });
  }

  async openFromHeaderIcon() {
    await expect(this.cartLink).toBeVisible({ timeout: 30000 });
    await Promise.all([
      this.page.waitForURL(/\/cart/i, { timeout: 30000 }).catch(() => undefined),
      this.cartLink.click(),
    ]);
    await expect(this.page).toHaveURL(/\/cart/i, { timeout: 30000 });
    await this.waitForCartReady();
  }

  async waitForCartReady() {
    const checkoutVisible = await this.checkoutSelectedButton.isVisible({ timeout: 10000 }).catch(() => false);
    if (checkoutVisible) return;

    const count = await this.getCartQuantityCount().catch(() => 0);
    if (count <= 0) {
      const emptyVisible = await this.emptyCartText.isVisible({ timeout: 2000 }).catch(() => false);
      throw new Error(
        `购物车为空：前置加购没有生效，因此无法出现 Checkout Selected items 按钮。当前购物车数量：${count}，空购物车提示可见：${emptyVisible}`,
      );
    }

    await expect(this.productRow("JKM")).toBeVisible({ timeout: 30000 }).catch(() => undefined);
    await expect(this.checkoutSelectedButton).toBeVisible({ timeout: 30000 });
  }

  async selectProduct(rowName) {
    const row = this.productRow(rowName);
    await expect(row).toBeVisible({ timeout: 30000 });

    const checkbox = row.getByRole("checkbox").first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check({ force: true }).catch(async () => {
        if (!(await checkbox.isChecked().catch(() => false))) {
          await checkbox.click({ force: true });
        }
      });
    }
  }

  async checkoutSelectedItems() {
    await expect(this.checkoutSelectedButton).toBeEnabled({ timeout: 30000 });
    await this.checkoutSelectedButton.click();
    await expect(this.sureButton).toBeVisible({ timeout: 30000 });
    await this.sureButton.click();
  }
}

module.exports = { CartPage };
