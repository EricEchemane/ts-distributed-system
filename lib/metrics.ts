import http from "node:http";
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

export class AppMetrics {
  readonly registry: Registry;

  readonly httpRequestDuration: Histogram<"method" | "route" | "status_code">;

  readonly eventsPublishedTotal: Counter<"event_type">;
  readonly eventsProcessedTotal: Counter<"event_type" | "status">;
  readonly eventProcessingDuration: Histogram<"event_type">;
  readonly consumerGroupPending: Gauge<"stream" | "group">;

  constructor(service: string) {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ service });
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "Duration of HTTP requests in seconds",
      labelNames: ["method", "route", "status_code"],
      registers: [this.registry],
    });

    this.eventsPublishedTotal = new Counter({
      name: "events_published_total",
      help: "Number of events published to the event bus",
      labelNames: ["event_type"],
      registers: [this.registry],
    });

    this.eventsProcessedTotal = new Counter({
      name: "events_processed_total",
      help: "Number of events consumed from the event bus",
      labelNames: ["event_type", "status"],
      registers: [this.registry],
    });

    this.eventProcessingDuration = new Histogram({
      name: "event_processing_duration_seconds",
      help: "Duration of event handler execution in seconds",
      labelNames: ["event_type"],
      registers: [this.registry],
    });

    this.consumerGroupPending = new Gauge({
      name: "consumer_group_pending_messages",
      help: "Number of messages in the Pending Entries List for a consumer group",
      labelNames: ["stream", "group"],
      registers: [this.registry],
    });
  }
}

export async function metricsHandler(metrics: AppMetrics) {
  return {
    contentType: metrics.registry.contentType,
    body: await metrics.registry.metrics(),
  };
}

export function startMetricsServer(metrics: AppMetrics, port: number) {
  const server = http.createServer(async (req, res) => {
    if (req.url !== "/metrics") {
      res.writeHead(404).end();
      return;
    }
    const { contentType, body } = await metricsHandler(metrics);
    res.writeHead(200, { "content-type": contentType }).end(body);
  });

  server.listen(port);
  return server;
}
