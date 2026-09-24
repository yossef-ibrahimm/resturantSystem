/** Prisma Decimal -> plain number at the API boundary so JSON stays numeric */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && typeof (v as { toNumber?: unknown }).toNumber === "function") {
    return (v as unknown as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}
