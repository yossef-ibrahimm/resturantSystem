import { num } from "./decimal.util";

describe("num()", () => {
  it("returns 0 for null", () => {
    expect(num(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(num(undefined)).toBe(0);
  });

  it("passes through plain numbers", () => {
    expect(num(42)).toBe(42);
    expect(num(0)).toBe(0);
    expect(num(-3.14)).toBe(-3.14);
  });

  it("calls toNumber() on Decimal-like objects", () => {
    const decimal = { toNumber: () => 99.95 };
    expect(num(decimal)).toBe(99.95);
  });

  it("converts numeric strings via Number()", () => {
    expect(num("123")).toBe(123);
    expect(num("0")).toBe(0);
  });

  it("returns NaN for non-numeric strings", () => {
    expect(num("abc")).toBeNaN();
  });
});
