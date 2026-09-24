import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

export function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: { email: string; name: string; role: "admin" | "kitchen_staff" | "waiter" | "cashier"; password?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException("Email already exists");

    const temporaryPassword = data.password || generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        passwordHash,
        mustChangePassword: true,
      },
      select: { id: true, email: true, name: true, role: true, active: true, mustChangePassword: true },
    });
    return { ...user, temporaryPassword };
  }

  async toggleActive(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException("You cannot deactivate your own account");
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    if (user.role === "admin" && user.active) {
      const adminCount = await this.prisma.user.count({ where: { role: "admin", active: true } });
      if (adminCount <= 1) {
        throw new ForbiddenException("Cannot deactivate the last active admin");
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: { active: !user.active },
      select: { id: true, email: true, name: true, role: true, active: true },
    });
  }

  async delete(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException("You cannot delete your own account");
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    if (user.role === "admin") {
      const adminCount = await this.prisma.user.count({ where: { role: "admin", active: true } });
      if (adminCount <= 1) {
        throw new ForbiddenException("Cannot deactivate the last active admin");
      }
    }

    // Soft-delete: deactivate instead of hard delete to preserve historical records
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: { id: true, email: true, name: true, role: true, active: true },
    });
  }
}
