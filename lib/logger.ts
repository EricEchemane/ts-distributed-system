import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export function createLogger(service: string) {
  return pino({
    level: process.env.LOG_LEVEL || "info",
    base: { service },
    transport: isProduction
      ? undefined
      : { target: "pino-pretty", options: { colorize: true } },
  });
}
