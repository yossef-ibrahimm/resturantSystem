import { Injectable, ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerException, ThrottlerModuleOptions, ThrottlerStorage } from "@nestjs/throttler";
import { Reflector } from "@nestjs/core";

const STAFF_ROLES = new Set(["admin", "kitchen_staff", "waiter", "cashier"]);

/**
 * Extends ThrottlerGuard to exempt authenticated staff roles from rate limiting.
 * Staff users (admin, kitchen_staff, waiter, cashier) bypass the default
 * throttle limits, which were tuned for anonymous public traffic.
 */
@Injectable()
export class StaffAwareThrottlerGuard extends ThrottlerGuard {
  constructor(options: ThrottlerModuleOptions, storageService: ThrottlerStorage, reflector: Reflector) {
    super(options, storageService, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If the user is an authenticated staff role, skip throttling
    if (user?.role && STAFF_ROLES.has(user.role)) {
      return true;
    }

    return super.canActivate(context);
  }
}
