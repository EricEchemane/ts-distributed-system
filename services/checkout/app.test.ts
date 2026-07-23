import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "@/services/checkout/app";
import { EventPublisher } from "@/lib/events/event-bus";
import { EventCatalog } from "@/lib/types";

function createFakeEventBus(): EventPublisher & { publish: ReturnType<typeof vi.fn> } {
  return { publish: vi.fn().mockResolvedValue(undefined) };
}

describe("POST /checkout", () => {
  it("returns 200 and publishes an event for a valid payload", async () => {
    const eventBus = createFakeEventBus();
    const app = createApp(eventBus);

    const res = await request(app)
      .post("/checkout")
      .send({ items: [{ sku: "ABC123", qty: 2 }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Order created event published" });
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish.mock.calls[0][0].type).toBe(EventCatalog.OrderCreated);
  });

  it("returns 400 for an invalid payload and does not publish", async () => {
    const eventBus = createFakeEventBus();
    const app = createApp(eventBus);

    const res = await request(app)
      .post("/checkout")
      .send({ items: [] });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid request");
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("returns 500 when the event bus fails", async () => {
    const eventBus = createFakeEventBus();
    eventBus.publish.mockRejectedValue(new Error("redis down"));
    const app = createApp(eventBus);

    const res = await request(app)
      .post("/checkout")
      .send({ items: [{ sku: "ABC123", qty: 1 }] });

    expect(res.status).toBe(500);
  });
});
