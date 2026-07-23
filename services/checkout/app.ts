import express, { Express } from "express";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { Logger } from "pino";
import { EventPublisher } from "@/lib/events/event-bus";
import { errorHandler } from "@/lib/http/error-handler";
import { registerCheckoutRoutes } from "@/services/checkout/routes";
import { AppMetrics, metricsHandler } from "@/lib/metrics";

export function createApp(eventBus: EventPublisher, logger: Logger, metrics: AppMetrics): Express {
  const app = express();
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/metrics" },
      genReqId: (req, res) => {
        const existing = req.headers["x-request-id"];
        const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
    }),
  );

  app.get("/metrics", async (_req, res) => {
    const { contentType, body } = await metricsHandler(metrics);
    res.set("content-type", contentType).send(body);
  });

  app.use((req, res, next) => {
    const endTimer = metrics.httpRequestDuration.startTimer({ method: req.method });
    res.on("finish", () => {
      endTimer({ route: req.route?.path ?? req.path, status_code: String(res.statusCode) });
    });
    next();
  });

  app.use(express.json());

  registerCheckoutRoutes(app, eventBus);

  app.use(errorHandler);
  return app;
}
