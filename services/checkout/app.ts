import express, { Express } from "express";
import { EventPublisher } from "@/lib/events/event-bus";
import { errorHandler } from "@/lib/http/error-handler";
import { registerCheckoutRoutes } from "@/services/checkout/routes";

export function createApp(eventBus: EventPublisher): Express {
  const app = express();
  app.use(express.json());

  registerCheckoutRoutes(app, eventBus);

  app.use(errorHandler);
  return app;
}
