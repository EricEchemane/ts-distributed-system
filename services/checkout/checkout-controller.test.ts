import { describe, it, expect, vi } from "vitest";
import { Request, Response } from "express";
import { createCheckoutController } from "@/services/checkout/checkout-controller";
import { EventPublisher } from "@/lib/events/event-bus";
import { EventCatalog } from "@/lib/types";

function createMockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("checkout controller", () => {
  it("publishes an OrderCreated event and responds 200", async () => {
    const eventBus: EventPublisher = { publish: vi.fn().mockResolvedValue(undefined) };
    const checkout = createCheckoutController(eventBus);

    const req = { body: { items: [{ sku: "ABC123", qty: 1 }] } } as Request;
    const res = createMockResponse();

    await checkout(req, res);

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const publishedEvent = (eventBus.publish as any).mock.calls[0][0];
    expect(publishedEvent.type).toBe(EventCatalog.OrderCreated);
    expect(JSON.parse(publishedEvent.payload)).toEqual(req.body);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      message: "Order created event published",
    });
  });

  it("throws on an invalid payload without publishing", async () => {
    const eventBus: EventPublisher = { publish: vi.fn().mockResolvedValue(undefined) };
    const checkout = createCheckoutController(eventBus);

    const req = { body: { items: [] } } as Request;
    const res = createMockResponse();

    await expect(checkout(req, res)).rejects.toThrow();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
