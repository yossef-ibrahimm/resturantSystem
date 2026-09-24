import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";

const DEFAULT_SETTINGS = {
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
};

type SettingsData = Partial<{
  nameAr: string;
  nameEn: string;
  logoUrl: string;
  menuBackgroundUrl: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  contactPhone: string;
  contactAddress: string;
  workingHours: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  whatsappNumber: string;
  taxEnabled: boolean;
  taxRate: number;
  serviceEnabled: boolean;
  serviceRate: number;
  cashShiftVarianceThreshold: number;
  totalTables: number;
  tableNumberStart: number;
  tableNumberEnd: number;
  staleThresholdMinutes: number;
}>;

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WebsocketGateway
  ) {}

  // Prisma returns Decimal fields as strings in JSON. Convert them to numbers
  // so the frontend never gets string surprises for numeric fields.
  private serialize(settings: any) {
    const toNum = (v: unknown, fallback: number): number => {
      if (v === undefined || v === null || v === "") return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    return {
      ...settings,
      taxRate: toNum(settings.taxRate, 0),
      serviceRate: toNum(settings.serviceRate, 0),
      cashShiftVarianceThreshold: toNum(settings.cashShiftVarianceThreshold, 50),
      totalTables: toNum(settings.totalTables, 0),
      tableNumberStart: toNum(settings.tableNumberStart, 1),
      tableNumberEnd: toNum(settings.tableNumberEnd, 50),
      staleThresholdMinutes: toNum(settings.staleThresholdMinutes, 30),
    };
  }

  // Phase 1 (audit CQ-4): no more swallow-all. DB failures now surface as real
  // errors; only a legitimately missing singleton row falls back to defaults.
  async get() {
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { id: "main" },
    });
    if (!settings) return { ...DEFAULT_SETTINGS, updatedAt: new Date() };
    return this.serialize(settings);
  }

  async update(data: SettingsData) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }

    const settings = await this.prisma.restaurantSettings.upsert({
      where: { id: "main" },
      update: cleaned,
      create: { ...DEFAULT_SETTINGS, ...cleaned },
    });

    const serialized = this.serialize(settings);
    this.wsGateway.broadcastSettingsUpdate(serialized as any);

    return serialized;
  }

  async reset() {
    const { id: _id, ...defaults } = DEFAULT_SETTINGS;

    const settings = await this.prisma.restaurantSettings.upsert({
      where: { id: "main" },
      update: defaults,
      create: DEFAULT_SETTINGS,
    });

    const serialized = this.serialize(settings);
    this.wsGateway.broadcastSettingsUpdate(serialized as any);

    return serialized;
  }
}
