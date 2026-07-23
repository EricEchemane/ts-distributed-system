import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "@/lib/http/app-error";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    res.status(400).send({ message: "Invalid request", issues: err.issues });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).send({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).send({ message: "Internal server error" });
};
