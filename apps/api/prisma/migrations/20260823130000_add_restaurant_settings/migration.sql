-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL DEFAULT 'Tasty Table',
    "nameEn" TEXT NOT NULL DEFAULT 'Tasty Table',
    "logoUrl" TEXT,
    "menuBackgroundUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "contactPhone" TEXT,
    "contactAddress" TEXT,
    "workingHours" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "tiktokUrl" TEXT,
    "whatsappNumber" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);

-- Seed default record
INSERT INTO "RestaurantSettings" ("id", "nameAr", "nameEn", "updatedAt")
VALUES ('main', 'Tasty Table', 'Tasty Table', NOW());
