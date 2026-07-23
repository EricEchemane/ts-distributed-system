import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { AppEvent, EventCatalog } from "@/lib/types";
import { EventPublisher } from "@/lib/events/event-bus";
import { checkoutRequestSchema } from "@/services/checkout/checkout-schema";

export function createCheckoutController(eventBus: EventPublisher) {
  return async function checkout(req: Request, res: Response) {
    const body = checkoutRequestSchema.parse(req.body);

    const newEvent = {
      id: randomUUID(),
      type: EventCatalog.OrderCreated,
      payload: JSON.stringify(body),
      createdAt: new Date().toISOString(),
    } satisfies AppEvent;

    req.log.info({ eventId: newEvent.id, eventType: newEvent.type }, "publishing event");
    await eventBus.publish(newEvent);
    res.status(200).send({ message: "Order created event published" });
  };
}
