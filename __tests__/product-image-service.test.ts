import { describe, expect, it } from "vitest";
import {
  PRODUCT_IMAGE_LIMIT,
  PRODUCT_IMAGE_MAX_BYTES,
  validateProductImage,
} from "@/services/productImageService";
describe("product images", () => {
  it("accepts supported images", () =>
    expect(() => validateProductImage({ type: "image/webp", size: 1 }, 0)).not.toThrow());
  it("rejects MIME", () =>
    expect(() => validateProductImage({ type: "image/svg+xml", size: 1 }, 0)).toThrow(/Tipo/));
  it("rejects oversized files", () =>
    expect(() =>
      validateProductImage({ type: "image/png", size: PRODUCT_IMAGE_MAX_BYTES + 1 }, 0),
    ).toThrow(/5 MB/));
  it("enforces eight", () =>
    expect(() =>
      validateProductImage({ type: "image/jpeg", size: 1 }, PRODUCT_IMAGE_LIMIT),
    ).toThrow(/oito/));
});
