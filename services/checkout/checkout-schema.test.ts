import { describe, it, expect } from "vitest";
import { checkoutRequestSchema } from "@/services/checkout/checkout-schema";

describe("checkoutRequestSchema", () => {
  it("accepts a valid payload", () => {
    const result = checkoutRequestSchema.parse({
      items: [{ sku: "ABC123", qty: 2 }],
    });

    expect(result).toEqual({ items: [{ sku: "ABC123", qty: 2 }] });
  });

  it("rejects an empty items array", () => {
    expect(() => checkoutRequestSchema.parse({ items: [] })).toThrow();
  });

  it("rejects a non-numeric qty", () => {
    expect(() =>
      checkoutRequestSchema.parse({ items: [{ sku: "ABC123", qty: "two" }] }),
    ).toThrow();
  });

  it("rejects a non-positive qty", () => {
    expect(() =>
      checkoutRequestSchema.parse({ items: [{ sku: "ABC123", qty: 0 }] }),
    ).toThrow();
  });

  it("rejects a missing items field", () => {
    expect(() => checkoutRequestSchema.parse({})).toThrow();
  });
});
