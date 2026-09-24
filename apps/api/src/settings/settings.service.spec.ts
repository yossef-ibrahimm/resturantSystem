import { Test, TestingModule } from "@nestjs/testing";
import { SettingsService } from "./settings.service";
import { PrismaService } from "../prisma/prisma.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";

/**
 * Phase 1 (audit CQ-4): the service no longer swallows database errors.
 * These tests codify HONEST behavior — failures propagate; only a missing
 * singleton row falls back to defaults.
 */
describe("SettingsService", () => {
  let service: SettingsService;
  let prisma: {
    restaurantSettings: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let wsGateway: { broadcastSettingsUpdate: jest.Mock };

  const mockSettings = {
    id: "main",
    nameAr: "Tasty Table",
    nameEn: "Tasty Table",
    logoUrl: null,
    menuBackgroundUrl: null,
    primaryColor: null,
    secondaryColor: null,
    backgroundColor: null,
    contactPhone: null,
    contactAddress: null,
    workingHours: null,
    facebookUrl: null,
    instagramUrl: null,
    tiktokUrl: null,
    whatsappNumber: null,
    taxEnabled: false,
    taxRate: 0,
    serviceEnabled: false,
    serviceRate: 0,
    cashShiftVarianceThreshold: 50,
    totalTables: 0,
    tableNumberStart: 1,
    tableNumberEnd: 50,
    staleThresholdMinutes: 30,
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      restaurantSettings: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    wsGateway = {
      broadcastSettingsUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: WebsocketGateway, useValue: wsGateway },
      ],
    }).compile();

    service = module.get(SettingsService);
  });

  describe("get", () => {
    it("should return existing settings", async () => {
      prisma.restaurantSettings.findUnique.mockResolvedValue(mockSettings);

      const result = await service.get();

      expect(result).toEqual(mockSettings);
    });

    it("should return defaults when the singleton row does not exist yet", async () => {
      prisma.restaurantSettings.findUnique.mockResolvedValue(null);

      const result = await service.get();

      expect(result.nameEn).toBe("Tasty Table");
      expect(result.id).toBe("main");
    });

    it("PROPAGATES database errors instead of faking success", async () => {
      prisma.restaurantSettings.findUnique.mockRejectedValue(new Error("connection refused"));

      await expect(service.get()).rejects.toThrow("connection refused");
    });
  });

  describe("update", () => {
    it("should upsert and broadcast changed settings", async () => {
      prisma.restaurantSettings.upsert.mockResolvedValue({ ...mockSettings, nameEn: "New Name" });

      const result = await service.update({ nameEn: "New Name" });

      expect(result.nameEn).toBe("New Name");
      expect(prisma.restaurantSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "main" },
          update: { nameEn: "New Name" },
        })
      );
      expect(wsGateway.broadcastSettingsUpdate).toHaveBeenCalled();
    });

    it("strips undefined values from the payload", async () => {
      prisma.restaurantSettings.upsert.mockResolvedValue(mockSettings);

      await service.update({ nameEn: "X", logoUrl: undefined } as any);

      const args = prisma.restaurantSettings.upsert.mock.calls[0][0];
      expect(args.update).toEqual({ nameEn: "X" });
      expect(args.update).not.toHaveProperty("logoUrl");
    });

    it("PROPAGATES persistence failures — no silent data loss", async () => {
      prisma.restaurantSettings.upsert.mockRejectedValue(new Error("write failed"));

      await expect(service.update({ nameEn: "X" })).rejects.toThrow("write failed");
      // Crucially: nothing was broadcast as if it had succeeded
      expect(wsGateway.broadcastSettingsUpdate).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("restores defaults via upsert and broadcasts", async () => {
      prisma.restaurantSettings.upsert.mockResolvedValue({ ...mockSettings, nameEn: "Tasty Table" });

      const result = await service.reset();

      expect(result.nameEn).toBe("Tasty Table");
      const args = prisma.restaurantSettings.upsert.mock.calls[0][0];
      expect(args.where).toEqual({ id: "main" });
      // every default field restored in the update branch
      expect(args.update.nameAr).toBe("Tasty Table");
      expect(args.update.logoUrl).toBeNull();
      expect(wsGateway.broadcastSettingsUpdate).toHaveBeenCalled();
    });

    it("PROPAGATES database errors", async () => {
      prisma.restaurantSettings.upsert.mockRejectedValue(new Error("boom"));

      await expect(service.reset()).rejects.toThrow("boom");
    });
  });
});
