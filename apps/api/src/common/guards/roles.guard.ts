import { Injectable, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * Role-based access guard. JWT validation is handled globally by JwtAuthGuard.
 * This guard only checks that the authenticated user has the required role.
 * Throws 403 Forbidden if the user's role is not in the allowed list.
 */
@Injectable()
export class RolesGuard {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("No authenticated user found");
    }

    if (!requiredRoles.includes(user.role)) {
      // BE-008: do not echo caller role or required role list (info disclosure).
      throw new ForbiddenException("You do not have permission to perform this action");
    }

    return true;
  }
}
