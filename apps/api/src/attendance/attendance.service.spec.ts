import { ConflictException } from "@nestjs/common";
import { AttendanceService } from "./attendance.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AttendanceService", () => {
  it("records clock-in and audit atomically", async () => {
    const created = { id: "attendance-1", userId: "user-1", clockOut: null, clockIn: new Date(), note: null };
    const prisma = {
      $transaction: jest.fn(
        async (
          callback: (tx: {
            attendance: { findFirst: jest.Mock; create: jest.Mock };
            auditLog: { create: jest.Mock };
          }) => Promise<unknown>
        ) =>
          callback({
            attendance: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue(created),
            },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
          })
      ),
    };
    const service = new AttendanceService(prisma as unknown as PrismaService);

    const result = await service.clockIn("user-1", "Opening shift");

    expect(result.active).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("rejects a concurrent clock-out when the record was already closed", async () => {
    const prisma = {
      attendance: { findFirst: jest.fn().mockResolvedValue({ id: "attendance-1", clockOut: null }) },
      $transaction: jest.fn(
        async (
          callback: (tx: {
            attendance: { updateMany: jest.Mock; findUnique: jest.Mock };
            auditLog: { create: jest.Mock };
          }) => Promise<unknown>
        ) =>
          callback({
            attendance: {
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
              findUnique: jest.fn(),
            },
            auditLog: { create: jest.fn() },
          })
      ),
    };
    const service = new AttendanceService(prisma as unknown as PrismaService);

    await expect(service.clockOut("user-1")).rejects.toThrow(ConflictException);
  });
});
