import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const CAIRO_TZ = "Africa/Cairo";

function cairoStartOfDay(d: Date): Date {
  const ymd = formatInTimeZone(d, CAIRO_TZ, "yyyy-MM-dd");
  return fromZonedTime(`${ymd}T00:00:00`, CAIRO_TZ);
}

function parseRangeDate(val: string | undefined, mode: "start" | "end", fallback: Date): Date {
  if (!val) return fallback;
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return mode === "start"
      ? fromZonedTime(`${trimmed}T00:00:00`, CAIRO_TZ)
      : fromZonedTime(`${trimmed}T23:59:59.999`, CAIRO_TZ);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private findOpenRecord(userId: string) {
    return this.prisma.attendance.findFirst({
      where: { userId, clockOut: null },
      orderBy: { clockIn: "desc" },
    });
  }

  async status(userId: string) {
    const record = await this.findOpenRecord(userId);
    return { active: Boolean(record), record };
  }

  async clockIn(userId: string, note?: string) {
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const open = await tx.attendance.findFirst({ where: { userId, clockOut: null } });
        if (open) throw new BadRequestException("Already clocked in");
        const created = await tx.attendance.create({ data: { userId, note: note || null } });
        await tx.auditLog.create({
          data: {
            action: "attendance.clock_in",
            entityType: "Attendance",
            entityId: created.id,
            userId,
            afterJson: { clockIn: created.clockIn, note: created.note },
          },
        });
        return created;
      });
      return { active: true, record };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Attendance was already started");
      }
      throw error;
    }
  }

  async clockOut(userId: string) {
    const open = await this.findOpenRecord(userId);
    if (!open) throw new BadRequestException("No active shift to clock out");

    const clockOut = new Date();
    const record = await this.prisma.$transaction(async (tx) => {
      const result = await tx.attendance.updateMany({
        where: { id: open.id, clockOut: null },
        data: { clockOut },
      });
      if (result.count === 0) throw new ConflictException("Attendance was already ended");
      const updated = await tx.attendance.findUnique({ where: { id: open.id } });
      if (!updated) throw new ConflictException("Attendance record changed unexpectedly");
      await tx.auditLog.create({
        data: {
          action: "attendance.clock_out",
          entityType: "Attendance",
          entityId: updated.id,
          userId,
          beforeJson: { clockOut: null },
          afterJson: { clockOut: updated.clockOut },
        },
      });
      return updated;
    });
    return { active: false, record };
  }

  async today() {
    const now = new Date();
    const start = cairoStartOfDay(now);
    const end = fromZonedTime(`${formatInTimeZone(now, CAIRO_TZ, "yyyy-MM-dd")}T23:59:59.999`, CAIRO_TZ);

    return this.prisma.attendance.findMany({
      where: { clockIn: { gte: start, lte: end } },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { clockIn: "asc" },
    });
  }

  async records(from?: string, to?: string, userId?: string) {
    const now = new Date();
    const end = parseRangeDate(to, "end", now);
    const start = parseRangeDate(from, "start", cairoStartOfDay(now));

    return this.prisma.attendance.findMany({
      where: {
        clockIn: { gte: start, lte: end },
        ...(userId ? { userId } : {}),
      },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { clockIn: "desc" },
    });
  }

  async summary(from?: string, to?: string) {
    const now = new Date();
    const end = parseRangeDate(to, "end", now);
    const start = parseRangeDate(from, "start", cairoStartOfDay(now));

    const records = await this.prisma.attendance.findMany({
      where: { clockIn: { gte: start, lte: end } },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    const byUser = new Map<
      string,
      {
        userId: string;
        name: string;
        role: string;
        totalMs: number;
        days: Set<string>;
        shifts: number;
      }
    >();

    for (const r of records) {
      const day = formatInTimeZone(r.clockIn, CAIRO_TZ, "yyyy-MM-dd");
      const endTime = r.clockOut ?? new Date();
      const totalMs = Math.max(0, endTime.getTime() - r.clockIn.getTime());

      const entry = byUser.get(r.userId) || {
        userId: r.userId,
        name: r.user.name,
        role: r.user.role,
        totalMs: 0,
        days: new Set<string>(),
        shifts: 0,
      };
      entry.totalMs += totalMs;
      entry.days.add(day);
      entry.shifts += 1;
      byUser.set(r.userId, entry);
    }

    return [...byUser.values()]
      .map((u) => ({
        userId: u.userId,
        name: u.name,
        role: u.role,
        totalMinutes: Math.round(u.totalMs / 60000),
        daysPresent: u.days.size,
        shifts: u.shifts,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }
}
