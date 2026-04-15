import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  
  DATABASE_URL: z.string().startsWith("postgres", { message: "Must be a valid Postgres connection string" }),
  APP_URL: z.url().default("http://localhost:8080"),
  
  JWT_ACCESS_SECRET: z.string().min(32, { message: "JWT access secret must be at least 32 characters" }),
  JWT_REFRESH_SECRET: z.string().min(32, { message: "JWT refresh secret must be at least 32 characters" }),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = envSchema.parse(process.env);