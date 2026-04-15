import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError.js";

const isObject = (val: unknown): val is Record<string, unknown> =>
  typeof val === "object" && val !== null;

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = 500;
  let message = "Internal Server Error";

  // 1. Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    res.status(statusCode).json({ success: false, error: message });
    return;
  }

  // 2. Custom ApiErrors
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    if (statusCode >= 500) console.error("[ApiError 5xx]:", err);
    res.status(statusCode).json({ success: false, error: message });
    return;
  }

  // 3. PostgreSQL unique constraint violation
  if (isObject(err) && typeof err.code === "string" && err.code === "23505") {
    statusCode = 409;
    message = "A record with this information already exists.";
    res.status(statusCode).json({ success: false, error: message });
    return;
  }

  // 4. PostgreSQL foreign key violation
  if (isObject(err) && typeof err.code === "string" && err.code === "23503") {
  statusCode = 400;
  message = "Invalid reference — related record does not exist.";
  res.status(statusCode).json({ success: false, error: message });
  return;
}

  // 5. Fallback
  console.error("[Unhandled Error]:", err);
  res.status(statusCode).json({ success: false, error: message });
};
