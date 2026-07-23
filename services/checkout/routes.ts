import { Express } from "express";
import { EventPublisher } from "@/lib/events/event-bus";
import { createCheckoutController } from "@/services/checkout/checkout-controller";

export function registerCheckoutRoutes(app: Express, eventBus: EventPublisher) {
  app.post("/checkout", createCheckoutController(eventBus));
}
