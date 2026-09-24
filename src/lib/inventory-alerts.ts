import { toast } from "sonner";

export type StockLevel = "out" | "critical" | "low" | "ok";

export function getStockLevel(
  qty: number,
  minQty: number,
  reorderPoint: number
): StockLevel {
  if (qty <= 0) return "out";
  if (qty <= Number(minQty)) return "critical";
  if (qty <= Number(reorderPoint)) return "low";
  return "ok";
}

let audioCtx: AudioContext | null = null;

export function playAlertBeep(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    /* ignore audio errors */
  }
}

export function notifyLowStock(
  name: string,
  qty: number,
  unit: string,
  level: StockLevel,
  isArabic: boolean
): void {
  const msg = isArabic
    ? `تنبيه مخزون: «${name}» وصل إلى ${qty} ${unit}`
    : `Low stock alert: «${name}» is at ${qty} ${unit}`;
  const desc = isArabic
    ? "اقترب المخزون من النفاد — يُرجى إعادة الطلب"
    : "Stock is running low — please reorder soon";
  if (level === "out" || level === "critical") toast.error(msg, { description: desc });
  else toast.warning(msg, { description: desc });
  playAlertBeep();
}
