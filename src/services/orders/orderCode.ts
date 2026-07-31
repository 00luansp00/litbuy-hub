import { BuyerOrderParseError } from "./parserError";

export const ORDER_CODE_PATTERN = /^LIT-[23456789A-HJ-NP-Z]{14}$/;

export function isBuyerOrderCode(value: unknown): value is string {
  return typeof value === "string" && ORDER_CODE_PATTERN.test(value);
}

export function parseBuyerOrderCode(value: unknown): string {
  if (!isBuyerOrderCode(value)) throw new BuyerOrderParseError();
  return value;
}
