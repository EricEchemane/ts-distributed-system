import { RedisClientType } from "redis";
import { Logger } from "pino";
import {
  context,
  propagation,
  trace,
  SpanKind,
  SpanStatusCode,
} from "@opentelemetry/api";
import { AppEvent } from "@/lib/types";
import { EventBus, EventHandler, EventType } from "@/lib/events/event-bus";
import { AppMetrics } from "@/lib/metrics";

const READ_COUNT = 1;
const READ_BLOCK_MS = 5000;

const tracer = trace.getTracer("redis-event-bus");

export class RedisStreamEventBus implements EventBus {
  constructor(
    private readonly redisClient: RedisClientType,
    private readonly logger: Logger,
    private readonly metrics: AppMetrics,
  ) {}

  async publish(event: AppEvent): Promise<void> {
    await tracer.startActiveSpan(
      `${event.type} publish`,
      { kind: SpanKind.PRODUCER },
      async (span) => {
        try {
          span.setAttribute("messaging.system", "redis");
          span.setAttribute("messaging.destination", event.type);
          span.setAttribute("messaging.operation", "publish");

          const traceCarrier: Record<string, string> = {};
          propagation.inject(context.active(), traceCarrier);

          await this.redisClient.xAdd(event.type, "*", {
            ...(event as unknown as Record<string, string>),
            ...traceCarrier,
          });
          this.metrics.eventsPublishedTotal.inc({ event_type: event.type });
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  }

  async getPendingCount(stream: string, group: string): Promise<number> {
    try {
      const summary = await this.redisClient.xPending(stream, group);
      return summary.pending;
    } catch (err) {
      this.logger.warn({ err, stream, group }, "Failed to read pending count");
      return 0;
    }
  }

  async subscribe(
    stream: string,
    group: string,
    consumer: string,
    handlers: Partial<Record<EventType, EventHandler>>,
  ): Promise<void> {
    await this.ensureConsumerGroup(stream, group);

    while (true) {
      try {
        const response = await this.redisClient.xReadGroup(
          group,
          consumer,
          { key: stream, id: ">" },
          { COUNT: READ_COUNT, BLOCK: READ_BLOCK_MS },
        );

        if (!response) continue;

        for (const streamResponse of response) {
          for (const message of streamResponse.messages) {
            await this.handleMessage(stream, group, message, handlers);
          }
        }
      } catch (err) {
        this.logger.error({ err, stream }, "Error reading from stream");
      }
    }
  }

  private async handleMessage(
    stream: string,
    group: string,
    message: { id: string; message: unknown },
    handlers: Partial<Record<EventType, EventHandler>>,
  ): Promise<void> {
    const id = message.id;
    const event = message.message as AppEvent;
    const handler = handlers[event.type];
    const log = this.logger.child({ streamId: id, eventId: event.id, eventType: event.type });

    if (!handler) {
      log.warn("Unhandled event type");
      this.metrics.eventsProcessedTotal.inc({ event_type: event.type, status: "unhandled" });
      return;
    }

    const parentContext = propagation.extract(
      context.active(),
      message.message as Record<string, string>,
    );

    await context.with(parentContext, () =>
      tracer.startActiveSpan(
        `${event.type} process`,
        { kind: SpanKind.CONSUMER },
        async (span) => {
          span.setAttribute("messaging.system", "redis");
          span.setAttribute("messaging.destination", stream);
          span.setAttribute("messaging.operation", "process");

          const endTimer = this.metrics.eventProcessingDuration.startTimer({
            event_type: event.type,
          });
          try {
            await handler(event, id);
            await this.redisClient.xAck(stream, group, id);
            log.info("Event processed and acked");
            this.metrics.eventsProcessedTotal.inc({ event_type: event.type, status: "success" });
          } catch (err) {
            log.error({ err }, "Failed to process event; leaving unacked for retry");
            // Don't ack — it stays in the Pending Entries List (PEL) for retry/claim logic
            this.metrics.eventsProcessedTotal.inc({ event_type: event.type, status: "failure" });
            span.recordException(err as Error);
            span.setStatus({ code: SpanStatusCode.ERROR });
          } finally {
            endTimer();
            span.end();
          }
        },
      ),
    );
  }

  private async ensureConsumerGroup(
    stream: string,
    group: string,
  ): Promise<void> {
    try {
      // '$' = only new messages from now on; use '0' if you want to replay from the start
      await this.redisClient.xGroupCreate(stream, group, "$", {
        MKSTREAM: true,
      });
    } catch (err: any) {
      // BUSYGROUP just means the group already exists — safe to ignore
      if (!err.message?.includes("BUSYGROUP")) {
        throw err;
      }
    }
  }
}
