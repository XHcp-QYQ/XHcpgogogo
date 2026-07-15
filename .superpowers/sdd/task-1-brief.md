### Task 1: captchaOcr 瑙勮寖鍖栧嚱鏁?+ 鍗曟祴

**Files:**
- Create: `utils/captchaOcr.js`
- Create: `utils/captchaOcr.test.js`
- Modify: `package.json`锛堜粎澧炲姞 `"test:unit": "node --test utils/**/*.test.js"`锛?
**Interfaces:**
- Produces:
  - `normalizeCaptchaText(text: string): string` 鈥?trim銆佸幓闈炲瓧姣嶆暟瀛椼€佸ぇ鍐欙紱绌鸿緭鍏ヨ繑鍥?`""`
  - 锛堟湰浠诲姟鏆備笉瀹炵幇 recognize锛汿ask 2 杩藉姞锛?
- [ ] **Step 1: 鍐欏け璐ュ崟娴?*

鍒涘缓 `utils/captchaOcr.test.js`:

```js
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
```

- [ ] **Step 2: 杩愯纭澶辫触**

Run: `node --test utils/captchaOcr.test.js`  
Expected: FAIL锛坄Cannot find module './captchaOcr'` 鎴?`normalizeCaptchaText` 鏈鍑猴級

- [ ] **Step 3: 鏈€灏忓疄鐜拌鑼冨寲**

鍒涘缓 `utils/captchaOcr.js`:

```js
function normalizeCaptchaText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

module.exports = {
  normalizeCaptchaText,
};
```

鍦?`package.json` 鐨?`scripts` 涓鍔狅細

```json
"test:unit": "node --test utils/**/*.test.js"
```

- [ ] **Step 4: 杩愯纭閫氳繃**

Run: `npm run test:unit`  
Expected: PASS锛? tests锛?
- [ ] **Step 5: Commit锛堣烦杩囷紝闄ら潪鐢ㄦ埛鏄庣‘瑕佹眰锛?*

---
