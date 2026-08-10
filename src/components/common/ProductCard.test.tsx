import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { products } from "@/data/products";
import { ProductCard } from "./ProductCard";

vi.mock("@/providers/CartProvider", () => {
  throw new Error("ProductCard must not import the legacy CartProvider");
});

describe("ProductCard", () => {
  it("remains a read-only legacy product card without a mock cart action", () => {
    const product = products.find(
      ({ listingModel, productType }) =>
        listingModel !== "dynamic" &&
        listingModel !== "service" &&
        productType !== "virtual_currency",
    );

    expect(product).toBeDefined();
    render(<ProductCard product={product!} />);

    expect(screen.getByText(product!.title)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /adicionar ao carrinho/i })).toBeNull();
  });
});
