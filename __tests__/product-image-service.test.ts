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

import {
  parseImageList,
  parseIntent,
  parseProductImage,
  ProductImagePayloadError,
} from "@/services/productImageService";
const ready = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "READY",
  contentType: "image/png",
  sizeBytes: 1,
  altText: null,
  sortOrder: 0,
  isCover: true,
  viewUrl: "https://signed.test/image",
  viewExpiresAt: new Date().toISOString(),
};
describe("product image response parsers", () => {
  it("parses list, image and intent", () => {
    expect(parseProductImage(ready).id).toBe(ready.id);
    expect(parseImageList({ items: [ready], limit: 8 }).items).toHaveLength(1);
    expect(
      parseIntent({
        imageId: ready.id,
        uploadUrl: "https://upload.test",
        headers: { "Content-Type": "image/png", "If-None-Match": "*" },
      }).headers["If-None-Match"],
    ).toBe("*");
  });
  it.each([null, {}, { items: "bad", limit: 8 }])("rejects malformed payload %#", (value) =>
    expect(() => parseImageList(value)).toThrow(ProductImagePayloadError),
  );
});
