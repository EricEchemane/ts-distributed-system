import { AppEvent } from "@/lib/types";

export type EventType = AppEvent["type"];

export type EventHandler = (event: AppEvent, id: string) => Promise<void>;

export interface EventPublisher {
  publish(event: AppEvent): Promise<void>;
}

export interface EventConsumer {
  subscribe(
    stream: string,
    group: string,
    consumer: string,
    handlers: Partial<Record<EventType, EventHandler>>,
  ): Promise<void>;
}

export interface EventBus extends EventPublisher, EventConsumer {}
