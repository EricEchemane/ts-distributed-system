import { RedisClientType } from "redis";
import { AppEvent } from "@/lib/types";
import { EventBus, EventHandler, EventType } from "@/lib/events/event-bus";

const READ_COUNT = 1;
const READ_BLOCK_MS = 5000;

export class RedisStreamEventBus implements EventBus {
  constructor(private readonly redisClient: RedisClientType) {}

  async publish(event: AppEvent): Promise<void> {
    await this.redisClient.xAdd(
      event.type,
      "*",
      event as unknown as Record<string, string>,
    );
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
        console.error(`Error reading from stream "${stream}":`, err);
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

    if (!handler) {
      console.warn(`Unhandled event type: ${event.type}`);
      return;
    }

    try {
      await handler(event, id);
      await this.redisClient.xAck(stream, group, id);
    } catch (err) {
      console.error(`Failed to process ${id}:`, err);
      // Don't ack — it stays in the Pending Entries List (PEL) for retry/claim logic
    }
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
