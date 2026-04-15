import { env } from "./common/config/env.js";
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// Import the DB to ensure it connects and tests the pool on server startup.
import "./common/db/index.js";

// Import Modular Routes
import { authRoutes } from "./modules/auth/auth.routes.js";
import { moviesRoutes } from "./modules/movies/movies.routes.js";
import { bookingRoutes } from "./modules/booking/booking.routes.js";

// Import Global Error Handler
import { errorHandler } from "./common/middleware/error.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const app = express();
app.set("trust proxy", 1);

app.use(
  cors({
    origin: env.APP_URL, 
    credentials: true, 
  })
);

// Serves the frontend (index.html, style.css, JS) from the "public" folder.
app.use(express.static(path.join(ROOT_DIR, "public")));

app.use(express.json()); // Parses incoming JSON body payloads
app.use(cookieParser()); // Parses HttpOnly cookies for our refresh tokens

// Health Check Endpoint

app.get("/health", (_req: Request, res: Response): void => {
  res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

// API ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/movies", moviesRoutes);
app.use("/api/bookings", bookingRoutes);

// 4. Unknown API routes
app.use("/api", (_req, res) => {
   res.status(404).json({ success: false, message: "API route not found" });
});

// 5. CATCH-ALL ROUTE 
app.use((_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "public", "index.html"));
});


// 6. GLOBAL ERROR HANDLER
// It catches ZodErrors, ApiErrors, and raw errors, formatting them into standard JSON responses.
app.use(errorHandler);


// 7. SERVER STARTUP

app.listen(env.PORT, () => {
  console.log(`[Server] Running in ${env.NODE_ENV} mode`);
  console.log(`[Server] Listening on port: ${env.PORT}`);
});
