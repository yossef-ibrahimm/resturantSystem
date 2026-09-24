import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { ROLES_KEY } from "../decorators/roles.decorator";

function mockContext(user?: { role: string }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it("allows access when no roles are required", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
    expect(guard.canActivate(mockContext({ role: "kitchen_staff" }))).toBe(true);
  });

  it("allows access when empty roles array", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([]);
    expect(guard.canActivate(mockContext({ role: "kitchen_staff" }))).toBe(true);
  });

  it("allows access when user role matches required role", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin"]);
    expect(guard.canActivate(mockContext({ role: "admin" }))).toBe(true);
  });

  it("throws ForbiddenException when user role does not match", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin"]);
    expect(() => guard.canActivate(mockContext({ role: "kitchen_staff" }))).toThrow(
      ForbiddenException
    );
  });

  it("throws ForbiddenException when user is undefined (no JWT)", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin"]);
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(ForbiddenException);
  });

  it("allows access when multiple roles include user role", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin", "waiter"]);
    expect(guard.canActivate(mockContext({ role: "waiter" }))).toBe(true);
  });

  it("throws ForbiddenException with descriptive message on role mismatch", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin"]);
    try {
      guard.canActivate(mockContext({ role: "waiter" }));
      fail("Expected ForbiddenException");
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).message).toContain("waiter");
      expect((e as ForbiddenException).message).toContain("admin");
    }
  });
});
