import { OrdersController } from "./orders.controller";

describe("OrdersController", () => {
  it("does not attribute an anonymous order from an unverified token payload", async () => {
    const ordersService = { create: jest.fn().mockResolvedValue({ id: "order-1" }) };
    const controller = new OrdersController(ordersService as never);

    await controller.create(
      {
        customerName: "Guest",
        orderType: "takeaway",
        items: [{ menuItemId: "item-1", quantity: 1 }],
      } as never,
      {
        headers: {
          authorization: "Bearer forged.header.payload",
        },
        user: undefined,
      } as never
    );

    expect(ordersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdByUserId: undefined })
    );
  });
});