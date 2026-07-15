const Tesseract = require("tesseract.js");

function normalizeCaptchaText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function toImageSource(base64Img) {
  if (typeof base64Img !== "string" || !base64Img) {
    throw new Error("验证码图片 base64 为空");
  }
  if (base64Img.startsWith("data:image/")) {
    return base64Img;
  }
  return `data:image/png;base64,${base64Img}`;
}

async function recognizeCaptchaFromBase64(base64Img) {
  const image = toImageSource(base64Img);
  const result = await Tesseract.recognize(image, "eng", {
    logger: () => {},
  });
  return normalizeCaptchaText(result?.data?.text || "");
}

module.exports = {
  normalizeCaptchaText,
  recognizeCaptchaFromBase64,
};
