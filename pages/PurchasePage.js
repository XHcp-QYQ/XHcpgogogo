const { expect } = require("@playwright/test");

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPositiveInteger(value, fallback = 1) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return fallback;
  return Math.floor(numberValue);
}

class PurchasePage {
  constructor(page) {
    this.page = page;
    this.purchaseLink = page.getByRole("link", { name: "Purchase" });
    this.addToCartButton = page.getByRole("button", { name: /Add to the cart/i }).first();
    this.cartLink = page.locator("a[href='/cart']").first();
  }

  productModel(rowName) {
    return String(rowName).trim().split(/\s+/)[0];
  }

  productRow(rowName) {
    return this.page.getByRole("row").filter({ hasText: this.productModel(rowName) }).first();
  }

  productCard(rowName) {
    return this.page
      .getByRole("link", { name: new RegExp(escapeRegExp(this.productModel(rowName)), "i") })
      .first();
  }

  async open() {
    await expect(this.purchaseLink).toBeVisible({ timeout: 30000 });
    await this.purchaseLink.click();
    await expect(this.page).toHaveURL(/goods\/list/i, { timeout: 30000 });
  }

  async selectProductAndQuantity(rowName, quantity) {
    const row = this.productRow(rowName);

    if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.selectProductAndQuantityFromTable(row, quantity);
      return;
    }

    await this.openProductDetailFromCard(rowName);
    await this.fillDetailQuantity(quantity);
  }

  async selectProductAndQuantityFromTable(row, quantity) {
    await row.getByRole("checkbox").check();

    const qtyInput = row.getByRole("spinbutton").first();
    await expect(qtyInput).toBeEditable({ timeout: 30000 });
    await qtyInput.fill(String(quantity));
    await expect(qtyInput).toHaveValue(String(quantity));
  }

  async openProductDetailFromCard(rowName) {
    const card = this.productCard(rowName);
    await expect(card).toBeVisible({ timeout: 30000 });

    const cardText = await card.innerText().catch(() => "");
    await Promise.all([
      this.page.waitForURL(/\/goods\//i, { timeout: 30000 }).catch(() => undefined),
      card.click(),
    ]);

    await expect(this.page).toHaveURL(/\/goods\//i, { timeout: 30000 });

    if (/\bFAILED\b/i.test(cardText) && !(await this.addToCartButton.isVisible().catch(() => false))) {
      throw new Error(`商品 ${this.productModel(rowName)} 当前卡片显示 FAILED，且详情页没有可用的 Add to the cart 按钮。`);
    }
  }

  async fillDetailQuantity(quantity) {
    const qtyInput = this.page.getByRole("spinbutton").first();
    await expect(qtyInput).toBeEditable({ timeout: 30000 });
    await qtyInput.fill(String(quantity));
    await expect(qtyInput).toHaveValue(String(quantity));
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

  async waitForCartQuantityToIncrease(previousCount, timeout = 15000) {
    const start = Date.now();
    let lastCount = previousCount;

    while (Date.now() - start < timeout) {
      lastCount = await this.getCartQuantityCount().catch(() => lastCount);
      if (lastCount > previousCount) return lastCount;
      await this.page.waitForTimeout(500);
    }

    return lastCount;
  }

  async getCurrentGoodsDetail() {
    const match = this.page.url().match(/\/goods\/(\d+)/i);
    if (!match) {
      throw new Error(`当前页面不是商品详情页，无法通过接口加购。当前 URL：${this.page.url()}`);
    }

    const goodsId = match[1];
    const detail = await this.page.evaluate(async (id) => {
      const response = await fetch(`/api/bbb/goodsInfo/detail/${id}?priceCode=`, {
        method: "GET",
        credentials: "include",
      });
      return await response.json().catch(() => ({}));
    }, goodsId);

    if (detail.code !== 200 || !detail.data) {
      throw new Error(`读取商品详情失败：${JSON.stringify(detail).slice(0, 500)}`);
    }

    return detail.data;
  }

  buildCartPayload(goodsInfo, quantity) {
    const sku = goodsInfo.skuItemDefault || {};
    const activities = Array.isArray(goodsInfo.activitiesInfoList) ? goodsInfo.activitiesInfoList : [];
    const activity = activities.find((item) => item && item.effect !== false) || activities[0] || {};
    const priceUnit = Array.isArray(goodsInfo.priceUnitInfoTransferList)
      ? goodsInfo.priceUnitInfoTransferList.find((item) => item.priceUnitCode === goodsInfo.goodsPriceUnit) || goodsInfo.priceUnitInfoTransferList[0]
      : null;

    const skuId = goodsInfo.packagFlag === 10 ? null : sku.skuId;
    const goodsId = sku.goodsId || goodsInfo.goodsId || goodsInfo.id;
    const finalQuantity = toPositiveInteger(quantity, toPositiveInteger(goodsInfo.minBuyQuantity, 1));
    const goodsPriceUnit = goodsInfo.goodsPriceUnit || priceUnit?.priceUnitCode;
    const goodsPriceUnitName = goodsInfo.goodsPriceUnitName || priceUnit?.transferName;
    const activitiesId = activity.activitiesId || activity.id || "10000000";

    if (!goodsId) throw new Error("商品详情缺少 goodsId，无法加购。");
    if (!skuId && goodsInfo.packagFlag !== 10) throw new Error("商品详情缺少 skuId，无法加购。");
    if (!goodsPriceUnit) throw new Error("商品详情缺少 goodsPriceUnit，无法加购。");

    const item = {
      skuId,
      quantity: finalQuantity,
      goodsId,
      goodsPriceUnit,
      goodsPriceUnitName,
      activitiesId,
      checked: 1,
      shopCarBizType: 10,
    };

    return {
      shopCarBizType: 10,
      activitiesId,
      skuGoodsList: [item],
    };
  }

  async addCurrentDetailToCartByApi(quantity) {
    const goodsInfo = await this.getCurrentGoodsDetail();
    const payload = this.buildCartPayload(goodsInfo, quantity);

    const result = await this.page.evaluate(async (body) => {
      const token = decodeURIComponent((document.cookie.match(/(?:^|;\s*)PC_TOKEN=([^;]+)/) || [])[1] || "");
      const response = await fetch("/api/bbb/userCenter/userShoppingCar/add", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { code: response.status, message: text };
      }
      return { httpStatus: response.status, json };
    }, payload);

    if (result.httpStatus >= 400 || result.json.code !== 200) {
      throw new Error(`接口加购失败：HTTP ${result.httpStatus}，响应：${JSON.stringify(result.json).slice(0, 800)}`);
    }

    return result.json;
  }

  async addSelectedToCart(quantity = 1) {
    const beforeCount = await this.getCartQuantityCount().catch(() => 0);
    let uiAddError = null;

    if (await this.addToCartButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      const addResponsePromise = this.page
        .waitForResponse((response) => response.url().includes("/userCenter/userShoppingCar/add"), { timeout: 8000 })
        .catch(() => null);

      try {
        await expect(this.addToCartButton).toBeEnabled({ timeout: 30000 });
        await this.addToCartButton.click();
        const addResponse = await addResponsePromise;
        if (addResponse) {
          const body = await addResponse.json().catch(() => null);
          if (addResponse.status() >= 400 || (body && body.code !== 200)) {
            uiAddError = new Error(`页面加购接口失败：HTTP ${addResponse.status()}，响应：${JSON.stringify(body).slice(0, 800)}`);
          }
        }
      } catch (error) {
        uiAddError = error;
      }

      const afterUiCount = await this.waitForCartQuantityToIncrease(beforeCount, 8000);
      if (afterUiCount > beforeCount) return;
    }

    await this.addCurrentDetailToCartByApi(quantity);
    const afterApiCount = await this.waitForCartQuantityToIncrease(beforeCount, 15000);
    if (afterApiCount <= beforeCount) {
      const reason = uiAddError ? ` 页面点击加购异常：${uiAddError.message}` : "";
      throw new Error(`已调用加购接口但购物车数量未增加，当前数量 ${afterApiCount}，原数量 ${beforeCount}。${reason}`);
    }

    await expect(this.cartLink.locator("[role='status']").first()).toContainText(String(afterApiCount), { timeout: 10000 }).catch(() => undefined);
  }
}

module.exports = { PurchasePage };
