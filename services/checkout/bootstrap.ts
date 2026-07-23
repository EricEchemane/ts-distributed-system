import "dotenv/config";
import "@/lib/tracing";
import { createRedisClient } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { AppMetrics } from "@/lib/metrics";
import { RedisStreamEventBus } from "@/lib/events/redis-event-bus";
import { createApp } from "@/services/checkout/app";

const logger = createLogger("checkout");
const metrics = new AppMetrics("checkout");

const REDIS_URL = process.env.REDIS_URL;
const PORT = process.env.PORT || 8080;
if (!REDIS_URL) {
  logger.error("REDIS_URL environment variable is not set");
  process.exit(1);
}

const redisClient = createRedisClient(REDIS_URL, logger);
const eventBus = new RedisStreamEventBus(redisClient, logger, metrics);

async function startServer() {
  try {
    await redisClient.connect();

    const app = createApp(eventBus, logger, metrics);
    app.listen(PORT, () => {
      logger.info({ port: PORT }, "Checkout service is running");
    });
  } catch (err) {
    logger.error({ err }, "Failed to connect to Redis");
    process.exit(1);
  }
}

startServer().catch((err) => {
  logger.error({ err }, "Error starting checkout service");
  process.exit(1);
});
