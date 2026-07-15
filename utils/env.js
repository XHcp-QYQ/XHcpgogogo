require("dotenv").config();

function getEnv(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function getNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

module.exports = {
  BASE_URL: getEnv("BASE_URL", "https://testdm-inp.jinkosolar.com"),
  ACCOUNT: getEnv("TEST_ACCOUNT", "YYTestDealer1124"),
  PASSWORD: getEnv("TEST_PASSWORD", "Reset2026DM"),
  GRAPHIC_CODE: getEnv("GRAPHIC_CODE"),
  CAPTCHA_MODE: getEnv("CAPTCHA_MODE", "manual"),
  CAPTCHA_PROMPT_TIMEOUT_MS: getNumberEnv("CAPTCHA_PROMPT_TIMEOUT_MS", 120000),
  PRODUCT_ROW_NAME: getEnv("PRODUCT_ROW_NAME", "JKM620N-72HL4-V JKM620N-72HL4"),
  PURCHASE_QTY: getNumberEnv("PURCHASE_QTY", 100),
  ADDRESS_ROW_NAME: getEnv("ADDRESS_ROW_NAME", "chen bin chen bin 1 1"),
  PAYMENT_TERM: getEnv("PAYMENT_TERM", "%DP+90%BP"),
  FIRST_PAYMENT_METHOD: getEnv("FIRST_PAYMENT_METHOD", "T/T"),
  BALANCE_ROW_NAME: getEnv("BALANCE_ROW_NAME", "90% 55,710.000000 Balance"),
  BALANCE_PAYMENT_METHOD: getEnv("BALANCE_PAYMENT_METHOD", "L/C"),
  DELIVERY_DAY: getEnv("DELIVERY_DAY", "30"),
  DELIVERY_DAY_INDEX: getNumberEnv("DELIVERY_DAY_INDEX", 1),
  ORDER_NUMBER: getEnv("ORDER_NUMBER", "JKINPTEST2026Q36630DM"),
};
