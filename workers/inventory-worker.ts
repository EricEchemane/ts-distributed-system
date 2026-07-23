import "dotenv/config";
import "@/lib/tracing";
import { createRedisClient } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { AppMetrics, startMetricsServer } from "@/lib/metrics";
import { EventCatalog, EventConsumer, EventGroup } from "@/lib/types";
import { RedisStreamEventBus } from "@/lib/events/redis-event-bus";
import { db } from "@/databases/drizzle/db";
import { inventory } from "@/databases/drizzle/schema";

const logger = createLogger("inventory-worker");
const metrics = new AppMetrics("inventory-worker");

const REDIS_URL = process.env.REDIS_URL;
const METRICS_PORT = Number(process.env.METRICS_PORT) || 9091;
const PEL_POLL_MS = 10_000;
if (!REDIS_URL) {
  logger.error("REDIS_URL environment variable is not set");
  process.exit(1);
}

const redisClient = createRedisClient(REDIS_URL, logger);
const eventBus = new RedisStreamEventBus(redisClient, logger, metrics);

function pollPendingCount() {
  setInterval(async () => {
    const pending = await eventBus.getPendingCount(EventCatalog.OrderCreated, EventGroup.Inventory);
    metrics.consumerGroupPending.set(
      { stream: EventCatalog.OrderCreated, group: EventGroup.Inventory },
      pending,
    );
  }, PEL_POLL_MS);
}

async function startWorker() {
  logger.info("starting...");
  await redisClient.connect();
  startMetricsServer(metrics, METRICS_PORT);
  pollPendingCount();
  logger.info({ metricsPort: METRICS_PORT }, "started. Waiting for events...");

  await eventBus.subscribe(
    EventCatalog.OrderCreated,
    EventGroup.Inventory,
    EventConsumer.InventoryWorker,
    {
      [EventCatalog.OrderCreated]: async (event, id) => {
        const log = logger.child({ streamId: id, eventId: event.id });
        log.info({ payload: event.payload }, "Handling OrderCreated event");

        const inventoryData = await db.select().from(inventory);
        log.info({ inventoryData }, "Current inventory");
        // Here you would typically parse the payload and perform inventory checks or updates

        log.info("Process done");
      },
    },
  );
}

startWorker().catch((err) => {
  logger.error({ err }, "Failed to start worker");
  process.exit(1);
});
