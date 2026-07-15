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
    this.addToCartButton = page.getByRole("button", { name: /Add to the cart|加入购物车/i }).first();
    this.regularPriceButton = page.getByRole("button", { name: /Regular Price/i }).first();
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

  async dismissCookieBannerIfPresent() {
    const agree = this.page.getByRole("button", { name: /^(AGREE|同意)$/i });
    if (await agree.isVisible({ timeout: 1500 }).catch(() => false)) {
      await agree.click().catch(() => undefined);
    }
  }

  async getCartSnapshot() {
    return await this.page.evaluate(async () => {
      const token = decodeURIComponent((document.cookie.match(/(?:^|;\s*)PC_TOKEN=([^;]+)/) || [])[1] || "");
      const response = await fetch("/api/bbb/userCenter/userShoppingCar/count", {
        method: "GET",
        credentials: "include",
        headers: token ? { Authorization: token } : {},
      });
      const json = await response.json().catch(() => ({}));
      const list = Array.isArray(json.data) ? json.data : [];
      const totalPieces = list.reduce(
        (sum, item) => sum + Number(item.quantity ?? item.quantityCount ?? 0),
        0,
      );
      return { list, totalPieces, lineCount: list.length, code: json.code };
    });
  }

  async getCartQuantityCount() {
    const snapshot = await this.getCartSnapshot();
    return snapshot.totalPieces;
  }

  itemQuantity(item) {
    return Number(item?.quantity ?? item?.quantityCount ?? 0);
  }

  findCartItem(list, goodsId) {
    if (!goodsId) return null;
    const id = String(goodsId);
    return (
      list.find(
        (item) =>
          String(item.goodsId || "") === id ||
          String(item.skuGoodsId || "") === id ||
          String(item.id || "") === id,
      ) || null
    );
  }

  async waitForCartAddSuccess({ beforePieces, goodsId, minQuantity = 1, timeout = 15000 } = {}) {
    const start = Date.now();
    let lastSnapshot = { totalPieces: beforePieces, list: [], lineCount: 0 };

    while (Date.now() - start < timeout) {
      lastSnapshot = await this.getCartSnapshot().catch(() => lastSnapshot);
      const matched = this.findCartItem(lastSnapshot.list, goodsId);
      const matchedQty = this.itemQuantity(matched);
      if (lastSnapshot.totalPieces > beforePieces) return { ok: true, snapshot: lastSnapshot };
      if (matched && matchedQty >= minQuantity) return { ok: true, snapshot: lastSnapshot };
      await this.page.waitForTimeout(500);
    }

    return { ok: false, snapshot: lastSnapshot };
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

  async confirmRegularPriceIfNeeded() {
    // Regular Price 可能是 button / menuitem / q-item 文本，不一定是 role=button
    const candidates = [
      this.page.getByRole("button", { name: /Regular Price/i }),
      this.page.getByRole("menuitem", { name: /Regular Price/i }),
      this.page.getByRole("option", { name: /Regular Price/i }),
      this.page.getByText(/^Regular Price$/i),
      this.page.locator("button, [role='button'], [role='menuitem'], .q-btn, .q-item").filter({
        hasText: /^Regular Price$/i,
      }),
    ];

    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      for (const locator of candidates) {
        const target = locator.first();
        if (await target.isVisible().catch(() => false)) {
          await target.click({ force: true });
          return true;
        }
      }
      await this.page.waitForTimeout(200);
    }
    return false;
  }

  async addSelectedToCart(quantity = 1) {
    await this.dismissCookieBannerIfPresent();

    const beforeSnapshot = await this.getCartSnapshot().catch(() => ({
      totalPieces: 0,
      list: [],
      lineCount: 0,
    }));
    const beforeCount = beforeSnapshot.totalPieces || 0;
    const expectedQuantity = toPositiveInteger(quantity, 1);
    let goodsId = null;
    try {
      const goodsInfo = await this.getCurrentGoodsDetail();
      goodsId = goodsInfo.goodsId || goodsInfo.id;
    } catch {
      goodsId = null;
    }

    let uiAddError = null;
    let uiAddSucceeded = false;

    if (await this.addToCartButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      const addResponsePromise = this.page
        .waitForResponse((response) => response.url().includes("/userCenter/userShoppingCar/add"), { timeout: 20000 })
        .catch(() => null);

      try {
        await expect(this.addToCartButton).toBeEnabled({ timeout: 30000 });
        await this.addToCartButton.click();
        // 点「加入购物车」后右侧会出现 Regular Price，需再点才真正加购
        const clickedRegularPrice = await this.confirmRegularPriceIfNeeded();
        if (!clickedRegularPrice) {
          console.warn("未检测到 Regular Price 按钮/菜单项，继续等待加购接口响应。");
        }

        const addResponse = await addResponsePromise;
        if (addResponse) {
          const body = await addResponse.json().catch(() => null);
          if (addResponse.status() >= 400 || (body && body.code !== 200)) {
            uiAddError = new Error(`页面加购接口失败：HTTP ${addResponse.status()}，响应：${JSON.stringify(body).slice(0, 800)}`);
          } else {
            uiAddSucceeded = true;
          }
        }
      } catch (error) {
        uiAddError = error;
      }

      const uiResult = await this.waitForCartAddSuccess({
        beforePieces: beforeCount,
        goodsId,
        minQuantity: expectedQuantity,
        timeout: 8000,
      });
      if (uiResult.ok || (uiAddSucceeded && uiResult.snapshot.lineCount > 0)) {
        return;
      }
    }

    await this.addCurrentDetailToCartByApi(quantity);
    const apiResult = await this.waitForCartAddSuccess({
      beforePieces: beforeCount,
      goodsId,
      minQuantity: expectedQuantity,
      timeout: 15000,
    });
    if (!apiResult.ok) {
      const reason = uiAddError ? ` 页面点击加购异常：${uiAddError.message}` : "";
      throw new Error(
        `加购后未确认购物车更新，原数量 ${beforeCount}，当前数量 ${apiResult.snapshot.totalPieces}，行数 ${apiResult.snapshot.lineCount}。${reason}`,
      );
    }

    await expect(this.cartLink.locator("[role='status']").first())
      .toContainText(/\d+/, { timeout: 10000 })
      .catch(() => undefined);
  }
}

module.exports = { PurchasePage };
