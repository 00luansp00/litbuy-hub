import { describe, expect, it } from "vitest";
import { formatBrlMinorUnits } from "./formatMinorUnits";

describe("formatBrlMinorUnits", () => {
  it.each([
    ["0", "R$ 0,00"],
    ["5", "R$ 0,05"],
    ["12345", "R$ 123,45"],
    ["900719925474099312345", "R$ 9.007.199.254.740.993.123,45"],
  ])("formats %s with integer operations", (minor, expected) => {
    expect(formatBrlMinorUnits(minor)).toBe(expected);
  });

  it("does not present an invalid value as money", () => {
    expect(formatBrlMinorUnits("12.34")).toBe("Valor não disponível");
  });
});
