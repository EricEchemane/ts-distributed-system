import { createClient, RedisClientType } from "redis";

export function createRedisClient(url: string): RedisClientType {
  const client = createClient({ url });

  client.on("error", (err) => console.error("Redis Client Error", err));
  client.on("connect", () => console.log("Connected to Redis"));

  return client as RedisClientType;
}

export const QUEUE_KEY = "jobs:queue";
