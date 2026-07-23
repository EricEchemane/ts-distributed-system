import { createClient, RedisClientType } from "redis";
import { Logger } from "pino";

export function createRedisClient(url: string, logger: Logger): RedisClientType {
  const client = createClient({ url });

  client.on("error", (err) => logger.error({ err }, "Redis client error"));
  client.on("connect", () => logger.info("Connected to Redis"));

  return client as RedisClientType;
}

export const QUEUE_KEY = "jobs:queue";
