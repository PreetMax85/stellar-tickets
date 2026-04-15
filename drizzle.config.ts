/// <reference types="node" />
import { defineConfig } from "drizzle-kit";
import "dotenv/config";
import { env } from "./src/common/config/env.js";

export default defineConfig({
  schema: "./src/common/db/schema.ts",
  out: "./src/common/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL!,
  },
});