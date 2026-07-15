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
