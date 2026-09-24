import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let jwt: { sign: jest.Mock };

  const mockUser = {
    id: "user-1",
    email: "test@test.com",
    name: "Test User",
    passwordHash: "",
    role: "admin",
    active: true,
    mustChangePassword: false,
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash("password123", 10);
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = { sign: jest.fn().mockReturnValue("mock-token") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe("login", () => {
    it("should return user and token for valid credentials", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue("mock-token");

      const result = await service.login("test@test.com", "password123");

      expect(result.user.email).toBe("test@test.com");
      expect(result.user.role).toBe("admin");
      expect(result.token).toBe("mock-token");
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: "user-1",
        email: "test@test.com",
        role: "admin",
      });
    });

    it("should throw UnauthorizedException for non-existent email", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login("no@test.com", "password123")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException for inactive user", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, active: false });

      await expect(service.login("test@test.com", "password123")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException for wrong password", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.login("test@test.com", "wrongpassword")).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe("changePassword", () => {
    it("should update password and clear mustChangePassword flag", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});
      jwt.sign.mockReturnValue("mock-token");

      const result = await service.changePassword("user-1", "password123", "NewPass123");

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({ mustChangePassword: false }),
      });
    });

    it("should throw UnauthorizedException for wrong current password", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.changePassword("user-1", "wrongpassword", "newpass123")
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw BadRequestException for short new password", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.changePassword("user-1", "password123", "short")
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw UnauthorizedException for non-existent user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword("nonexistent", "password123", "NewPass123")
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
