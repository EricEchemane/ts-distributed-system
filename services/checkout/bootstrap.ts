import "dotenv/config";
import { createRedisClient } from "@/lib/redis";
import { RedisStreamEventBus } from "@/lib/events/redis-event-bus";
import { createApp } from "@/services/checkout/app";

const REDIS_URL = process.env.REDIS_URL;
const PORT = process.env.PORT || 8080;
if (!REDIS_URL) {
  console.error("REDIS_URL environment variable is not set");
  process.exit(1);
}

const redisClient = createRedisClient(REDIS_URL);
const eventBus = new RedisStreamEventBus(redisClient);

async function startServer() {
  try {
    await redisClient.connect();

    const app = createApp(eventBus);
    app.listen(PORT, () => {
      console.log(`Checkout service is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to Redis", err);
    process.exit(1);
  }
}

startServer().catch((err) => {
  console.error("Error starting checkout service", err);
  process.exit(1);
});
