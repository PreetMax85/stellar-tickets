import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "./auth.controller.js";

const router = Router();

// Rate limiter for login and password reset routes to prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: "Too many attempts from this IP, please try again after 15 minutes",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, 
  validate: { 
    xForwardedForHeader: false, 
    trustProxy: false 
  },
});

// Public routes
router.post("/register", AuthController.register);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);

// Rate-limited sensitive endpoints
router.post("/login", authLimiter, AuthController.login);
router.post("/forgot-password", authLimiter, AuthController.forgotPassword);
router.post("/reset-password", authLimiter, AuthController.resetPassword);

export const authRoutes = router;