-- Phase 1: database defense for non-negative menu prices.
ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_price_non_negative_check" CHECK ("price" >= 0);