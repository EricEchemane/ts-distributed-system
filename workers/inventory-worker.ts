import "dotenv/config";
import { createRedisClient } from "@/lib/redis";
import { EventCatalog, EventConsumer, EventGroup } from "@/lib/types";
import { RedisStreamEventBus } from "@/lib/events/redis-event-bus";
import { db } from "@/databases/drizzle/db";
import { inventory } from "@/databases/drizzle/schema";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error("REDIS_URL environment variable is not set");
  process.exit(1);
}

const redisClient = createRedisClient(REDIS_URL);
const eventBus = new RedisStreamEventBus(redisClient);

async function startWorker() {
  console.log("[Inventory-Worker] starting...");
  await redisClient.connect();
  console.log("[Inventory-Worker] started. Waiting for events...");

  await eventBus.subscribe(
    EventCatalog.OrderCreated,
    EventGroup.Inventory,
    EventConsumer.InventoryWorker,
    {
      [EventCatalog.OrderCreated]: async (event, id) => {
        console.log(`[inventory-Worker] Received event ${id}:`, event);
        console.log(
          `[inventory-Worker] Handling OrderCreated event with payload: ${event.payload}`,
        );

        const inventoryData = await db.select().from(inventory);
        console.log(`[inventory-Worker] Current inventory:`, inventoryData);
        // Here you would typically parse the payload and perform inventory checks or updates

        console.log(`[inventory-Worker] Process done: ${id}`);
      },
    },
  );
}

startWorker().catch((err) => {
  console.error("Failed to start worker:", err);
  process.exit(1);
});
