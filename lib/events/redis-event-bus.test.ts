import { describe, it, expect, vi } from "vitest";
import pino from "pino";
import { RedisStreamEventBus } from "@/lib/events/redis-event-bus";
import { AppEvent, EventCatalog } from "@/lib/types";
import { AppMetrics } from "@/lib/metrics";

const testLogger = pino({ level: "silent" });
const testMetrics = new AppMetrics("event-bus-test");

function createRedisClientMock(overrides: Partial<Record<string, any>> = {}) {
  return {
    xAdd: vi.fn().mockResolvedValue("0-1"),
    xAck: vi.fn().mockResolvedValue(1),
    xGroupCreate: vi.fn().mockResolvedValue("OK"),
    xReadGroup: vi.fn().mockReturnValue(new Promise(() => {})), // frozen by default
    ...overrides,
  };
}

function makeEvent(overrides: Partial<AppEvent> = {}): AppEvent {
  return {
    id: "event-1",
    type: EventCatalog.OrderCreated,
    payload: JSON.stringify({ foo: "bar" }),
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("RedisStreamEventBus.publish", () => {
  it("adds the event to the stream named after its type", async () => {
    const redisClient = createRedisClientMock();
    const bus = new RedisStreamEventBus(redisClient as any, testLogger, testMetrics);
    const event = makeEvent();

    await bus.publish(event);

    expect(redisClient.xAdd).toHaveBeenCalledWith(EventCatalog.OrderCreated, "*", event);
  });
});

describe("RedisStreamEventBus.subscribe", () => {
  it("creates the consumer group and rethrows non-BUSYGROUP errors", async () => {
    const redisClient = createRedisClientMock({
      xGroupCreate: vi.fn().mockRejectedValue(new Error("connection refused")),
    });
    const bus = new RedisStreamEventBus(redisClient as any, testLogger, testMetrics);

    await expect(
      bus.subscribe("stream", "group", "consumer", {}),
    ).rejects.toThrow("connection refused");
  });

  it("swallows a BUSYGROUP error and proceeds to read", async () => {
    const redisClient = createRedisClientMock({
      xGroupCreate: vi.fn().mockRejectedValue(new Error("BUSYGROUP already exists")),
    });
    const bus = new RedisStreamEventBus(redisClient as any, testLogger, testMetrics);

    bus.subscribe("stream", "group", "consumer", {});

    await vi.waitFor(() => expect(redisClient.xReadGroup).toHaveBeenCalled());
  });

  it("dispatches a message to its handler and acks on success", async () => {
    const event = makeEvent();
    const redisClient = createRedisClientMock({
      xReadGroup: vi
        .fn()
        .mockResolvedValueOnce([{ messages: [{ id: "1-0", message: event }] }])
        .mockReturnValue(new Promise(() => {})),
    });
    const bus = new RedisStreamEventBus(redisClient as any, testLogger, testMetrics);
    const handler = vi.fn().mockResolvedValue(undefined);

    bus.subscribe("stream", "group", "consumer", {
      [EventCatalog.OrderCreated]: handler,
    });

    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(event, "1-0"));
    expect(redisClient.xAck).toHaveBeenCalledWith("stream", "group", "1-0");
  });

  it("does not ack when the handler throws", async () => {
    const event = makeEvent();
    const redisClient = createRedisClientMock({
      xReadGroup: vi
        .fn()
        .mockResolvedValueOnce([{ messages: [{ id: "1-0", message: event }] }])
        .mockReturnValue(new Promise(() => {})),
    });
    const bus = new RedisStreamEventBus(redisClient as any, testLogger, testMetrics);
    const handler = vi.fn().mockRejectedValue(new Error("boom"));

    bus.subscribe("stream", "group", "consumer", {
      [EventCatalog.OrderCreated]: handler,
    });

    await vi.waitFor(() => expect(handler).toHaveBeenCalled());
    expect(redisClient.xAck).not.toHaveBeenCalled();
  });

  it("warns and does not ack for an unhandled event type", async () => {
    const event = makeEvent({ type: EventCatalog.UserCreated });
    const redisClient = createRedisClientMock({
      xReadGroup: vi
        .fn()
        .mockResolvedValueOnce([{ messages: [{ id: "1-0", message: event }] }])
        .mockReturnValue(new Promise(() => {})),
    });
    const bus = new RedisStreamEventBus(redisClient as any, testLogger, testMetrics);
    const warnSpy = vi.spyOn(testLogger, "warn").mockImplementation(() => {});

    bus.subscribe("stream", "group", "consumer", {
      [EventCatalog.OrderCreated]: vi.fn(),
    });

    await vi.waitFor(() => expect(warnSpy).toHaveBeenCalled());
    expect(redisClient.xAck).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
