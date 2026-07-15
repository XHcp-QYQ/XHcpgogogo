const { expect } = require("@playwright/test");

class OrderPage {
  constructor(page) {
    this.page = page;
    this.addDeliveryAddressButton = page.getByRole("button", { name: "Add delivery address" });
    this.sureButton = page.getByRole("button", { name: "Sure" });
    this.submitOrderButton = page.getByRole("button", { name: "Submit an order" });
    this.viewOrdersButton = page.getByRole("button", { name: "View orders" });
  }

  async chooseDeliveryAddress(addressRowName) {
    await expect(this.addDeliveryAddressButton).toBeVisible({ timeout: 30000 });
    await this.addDeliveryAddressButton.click();

    const addressRow = this.page.getByRole("row", { name: addressRowName });
    await expect(addressRow).toBeVisible({ timeout: 30000 });
    await addressRow.getByRole("button").first().click();
  }

  async selectPaymentTerm(termText) {
    await this.page.getByText("Click to select", { exact: true }).click();

    const dialog = this.page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 30000 });

    const paymentTermSelect = dialog.locator(".el-select .el-input__inner").first();
    await expect(paymentTermSelect).toBeVisible({ timeout: 30000 });
    await paymentTermSelect.click();

    const option = this.page.getByRole("listitem").filter({ hasText: termText }).first();
    await expect(option).toBeVisible({ timeout: 30000 });
    await option.click();
  }

  async selectFirstPaymentMethod(methodText) {
    const paymentSelect = this.page.getByRole("textbox", { name: "Please select" }).first();
    await expect(paymentSelect).toBeVisible({ timeout: 30000 });
    await paymentSelect.click();
    await this.page.getByRole("listitem").filter({ hasText: methodText }).click();
  }

  async selectBalancePaymentMethod(balanceRowName, methodText) {
    const dialog = this.page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 30000 });

    const balanceRow = dialog.locator("tr", { hasText: /^\s*90%[\s\S]*Balance payment/i }).first();
    await expect(balanceRow).toBeVisible({ timeout: 30000 });

    const paymentMethodInput = balanceRow.locator("td").nth(3).locator("input").first();
    await expect(paymentMethodInput).toBeAttached({ timeout: 30000 });

    const currentValue = await paymentMethodInput.inputValue().catch(() => "");
    if (!currentValue.includes(methodText)) {
      await paymentMethodInput.click({ force: true });
      const option = this.page.getByRole("listitem").filter({ hasText: methodText }).first();
      await expect(option).toBeVisible({ timeout: 30000 });
      await option.click();
    }

    const sureButton = dialog.getByRole("button", { name: "Sure" });
    await expect(sureButton).toBeVisible({ timeout: 30000 });
    await sureButton.click();
  }

  async selectDeliveryDateByDay(dayText = "30", occurrenceIndex = 1) {
    const dateInput = this.page.locator(".el-date-editor > .el-input__inner").first();
    await expect(dateInput).toBeVisible({ timeout: 30000 });
    await dateInput.click();
    await this.page.getByText(dayText, { exact: true }).nth(occurrenceIndex).click();
  }

  async submitOrder() {
    await expect(this.submitOrderButton).toBeEnabled({ timeout: 30000 });
    await this.submitOrderButton.click();
    await expect(this.sureButton).toBeVisible({ timeout: 30000 });
    await this.sureButton.click();
  }

  async openOrdersFromPaySuccess(baseURL) {
    await this.page.goto(new URL("/cart/paySuccess", baseURL).toString(), { waitUntil: "domcontentloaded" });
    await expect(this.viewOrdersButton).toBeVisible({ timeout: 30000 });
    await this.viewOrdersButton.click();
  }

  async openOrderByNumber(orderNumber) {
    const orderLink = this.page.getByRole("link", { name: new RegExp(`Order number:${orderNumber}`) });
    await expect(orderLink).toBeVisible({ timeout: 30000 });
    await orderLink.click();
  }
}

module.exports = { OrderPage };
