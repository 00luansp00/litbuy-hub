import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const surfaces = [
  "src/routes/pedidos.$id.tsx",
  "src/routes/vendedor.vendas.$id.tsx",
  "src/routes/mensagens.tsx",
  "src/routes/mensagens.$id.tsx",
  "src/components/orders/OrderChatCard.tsx",
];

describe("neutralização dos mocks nas superfícies reais", () => {
  it.each(surfaces)("%s não usa messageService nem seeds demonstrativas", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    expect(source).not.toMatch(
      /messageService|Modo demonstração — nada foi persistido\.|\bc[1-5]\b/,
    );
  });
  it("o chat real não possui fallback mock, WebSocket ou HTML perigoso", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/orders/OrderChatCard.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(
      /sanitizeExternalContact|dangerouslySetInnerHTML|WebSocket|simulate/,
    );
  });
});
