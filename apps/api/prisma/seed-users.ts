import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

// DB-003: no hardcoded passwords. Env override or one-time random per user.
type SeedUser = { email: string; name: string; role: Role; password: string };

function gen(): string {
  return randomBytes(12).toString("base64url");
}

const SEED_USER_DEFS: { email: string; name: string; role: Role; envKey: string }[] = [
  { email: "admin@tastytable.com", name: "Admin", role: "admin", envKey: "SEED_ADMIN_PASSWORD" },
  { email: "kitchen@tastytable.com", name: "Kitchen Staff", role: "kitchen_staff", envKey: "SEED_KITCHEN_PASSWORD" },
  { email: "waiter@tastytable.com", name: "Waiter", role: "waiter", envKey: "SEED_WAITER_PASSWORD" },
  { email: "cashier@tastytable.com", name: "Cashier", role: "cashier", envKey: "SEED_CASHIER_PASSWORD" },
];

const SEED_USERS: SeedUser[] = SEED_USER_DEFS.map((u) => ({
  email: u.email,
  name: u.name,
  role: u.role,
  password: process.env[u.envKey] ?? gen(),
}));

async function main() {
  for (const u of SEED_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    const passwordHash = await bcrypt.hash(u.password, 10);
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, active: true, mustChangePassword: true },
      });
      console.log(`= updated: ${u.email} (${u.role})`);
    } else {
      await prisma.user.create({
        data: { email: u.email, name: u.name, role: u.role, passwordHash, active: true, mustChangePassword: true },
      });
      console.log(`+ created: ${u.email} (${u.role})`);
    }
  }
  console.log("\nOne-time credentials (printed once — must change on first login):");
  for (const u of SEED_USERS) console.log(`  ${u.role.padEnd(15)} ${u.email}  password=${u.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
