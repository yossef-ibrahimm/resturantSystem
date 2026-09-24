import { BadRequestException, Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CashShiftsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Return the currently open shift (single-drawer policy: at most one at a time).
   */
  async getCurrentOpen() {
    return this.prisma.cashShift.findFirst({
      where: { status: "open" },
      orderBy: { openedAt: "desc" },
    });
  }

  /**
   * Open a new shift. Rejects if a shift is already open.
   * DB-005: CashShift_one_open_idx enforces single open shift; map unique violation to 409.
   */
  async open(openedById: string, openingFloat: number) {
    if (!Number.isFinite(openingFloat) || openingFloat < 0) {
      throw new BadRequestException("openingFloat must be a non-negative number");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.cashShift.findFirst({
          where: { status: "open" },
          orderBy: { openedAt: "desc" },
        });
        if (existing) {
          throw new BadRequestException(
            `A cash shift is already open (id=${existing.id}, opened at ${existing.openedAt.toISOString()}). Close it first.`
          );
        }

        return tx.cashShift.create({
          data: {
            openedById,
            openingFloat: new Prisma.Decimal(openingFloat),
            status: "open",
          },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A cash shift is already open. Close it first.");
      }
      throw err;
    }
  }

  /**
   * Close the current open shift.
   *
   * BE-012 expected-cash formula (drawer truth):
   *   expected = openingFloat
   *            + Σ positive cash payments in this shift
   *            + Σ negative cash payments in this shift   (cash refunds leave the drawer)
   *            − Σ cash expenses in this shift
   *
   * Non-cash payments/refunds (card, wallet, other) never touch the physical
   * drawer and are intentionally excluded — a card refund paid out in cash is
   * recorded as a negative `method:"cash"` row and is folded in above.
   *
   * BE-013: |variance| must be within `cashShiftVarianceThreshold` from
   * settings, OR the closer must supply explanatory notes. Threshold breach
   * without notes → 400.
   */
  async close(closedById: string, closingFloat: number, notes?: string) {
    if (!Number.isFinite(closingFloat) || closingFloat < 0) {
      throw new BadRequestException("closingFloat must be a non-negative number");
    }

    return this.prisma.$transaction(async (tx) => {
      const open = await tx.cashShift.findFirst({
        where: { status: "open" },
        orderBy: { openedAt: "desc" },
      });
      if (!open) {
        throw new BadRequestException("No open shift to close");
      }

      const [cashIn, cashOut, cashExpenses, settings] = await Promise.all([
        tx.payment.aggregate({
          where: { cashShiftId: open.id, method: "cash", amount: { gt: 0 } },
          _sum: { amount: true },
        }),
        tx.payment.aggregate({
          where: { cashShiftId: open.id, method: "cash", amount: { lt: 0 } },
          _sum: { amount: true },
        }),
        tx.expense.aggregate({
          where: { cashShiftId: open.id, paymentMethod: "cash", deletedAt: null },
          _sum: { amount: true },
        }),
        tx.restaurantSettings.findUnique({ where: { id: "main" } }),
      ]);

      const opening = new Prisma.Decimal(open.openingFloat);
      const cashInTotal = new Prisma.Decimal(cashIn._sum.amount ?? 0);
      const cashOutTotal = new Prisma.Decimal(cashOut._sum.amount ?? 0); // negative
      const cashExpenseTotal = new Prisma.Decimal(cashExpenses._sum.amount ?? 0);
      const expectedCash = opening.add(cashInTotal).add(cashOutTotal).sub(cashExpenseTotal);
      const closing = new Prisma.Decimal(closingFloat);
      const variance = closing.sub(expectedCash);

      // BE-013 — enforce variance threshold (default 50 when unset)
      const thresholdRaw = settings?.cashShiftVarianceThreshold;
      const threshold =
        thresholdRaw === null || thresholdRaw === undefined
          ? 50
          : Number(thresholdRaw);
      const safeThreshold = Number.isFinite(threshold) ? threshold : 50;
      const absVariance = variance.abs().toNumber();
      const hasNotes = typeof notes === "string" && notes.trim().length > 0;
      if (absVariance > safeThreshold && !hasNotes) {
        throw new BadRequestException(
          `Cash variance ${variance.toString()} exceeds threshold ±${safeThreshold}. ` +
            `Provide explanatory notes to close, or adjust the drawer.`
        );
      }

      return tx.cashShift.update({
        where: { id: open.id },
        data: {
          closedById,
          closedAt: new Date(),
          closingFloat: closing,
          expectedCash,
          variance,
          notes: notes || null,
          status: "closed",
        },
      });
    });
  }

  async findById(id: string) {
    const shift = await this.prisma.cashShift.findUnique({
      where: { id },
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true, email: true } },
        payments: { orderBy: { paidAt: "asc" } },
      },
    });
    if (!shift) throw new NotFoundException("Shift not found");
    return {
      ...shift,
      openingFloat: Number(shift.openingFloat),
      closingFloat: shift.closingFloat != null ? Number(shift.closingFloat) : null,
      expectedCash: shift.expectedCash != null ? Number(shift.expectedCash) : null,
      variance: shift.variance != null ? Number(shift.variance) : null,
      payments: shift.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    };
  }

  async findAll(params?: { take?: number; skip?: number }) {
    const take = Math.min(Math.max(params?.take ?? 50, 1), 500);
    const skip = Math.max(params?.skip ?? 0, 0);

    const [items, total] = await Promise.all([
      this.prisma.cashShift.findMany({
        orderBy: { openedAt: "desc" },
        take,
        skip,
        include: {
          openedBy: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.cashShift.count(),
    ]);

    return {
      items: items.map((s) => ({
        ...s,
        openingFloat: Number(s.openingFloat),
        closingFloat: s.closingFloat != null ? Number(s.closingFloat) : null,
        expectedCash: s.expectedCash != null ? Number(s.expectedCash) : null,
        variance: s.variance != null ? Number(s.variance) : null,
      })),
      total,
      take,
      skip,
    };
  }
}
