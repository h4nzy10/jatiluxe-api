import crypto from "node:crypto";

export function generateCode(prefix = "", digitLength = 13) {
  let digits = "";

  for (let i = 0; i < digitLength; i++) {
    digits += crypto.randomInt(0, 10);
  }

  return `${prefix}${digits}`;
}