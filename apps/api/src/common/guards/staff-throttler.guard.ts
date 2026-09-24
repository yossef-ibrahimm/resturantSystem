import { Injectable, ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from "@nestjs/throttler";
import { Reflector } from "@nestjs/core";

const STAFF_ROLES = new Set(["admin", "kitchen_staff", "waiter", "cashier"]);

const STAFF_LIMIT = 300;
const STAFF_TTL_MS = 60_000;
const STAFF_BLOCK_MS = 60_000;

/**
 * BE-001: staff no longer bypass throttling entirely.
 * Authenticated staff get a higher limit (generous for POS) but still
 * go through rate limiting so brute-force / abuse stays bounded.
 * Anonymous/public traffic keeps the route-configured default limits.
 */
@Injectable()
export class StaffAwareThrottlerGuard extends ThrottlerGuard {
  constructor(options: ThrottlerModuleOptions, storageService: ThrottlerStorage, reflector: Reflector) {
    super(options, storageService, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.role && STAFF_ROLES.has(user.role)) {
      const { req } = this.getRequestResponse(context);
      const tracker = await this.getTracker(req);
      const key = this.generateKey(context, tracker, "staff");
      const record = await this.storageService.increment(
        key,
        STAFF_TTL_MS,
        STAFF_LIMIT,
        STAFF_BLOCK_MS,
        "staff",
      );

      if (record.isBlocked || record.totalHits > STAFF_LIMIT) {
        await this.throwThrottlingException(context, {
          ...record,
          ttl: STAFF_TTL_MS,
          limit: STAFF_LIMIT,
          key,
          tracker,
        });
      }
      return true;
    }

    return super.canActivate(context);
  }
}
