import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";

// Extend the Express Request to include our user payload
export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export const requireAuth = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    // 1. Check if the Authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Authentication token is missing or invalid");
    }

    // 2. Extract the token (Format: "Bearer <token>")
    const token = authHeader.split(" ")[1];
    if (!token) {
      throw ApiError.unauthorized("Authentication token is missing");
    }

    // 3. Verify the token using your robust utility
    // If it fails, verifyAccessToken throws an ApiError which is caught below
    const decoded = verifyAccessToken(token);

    // 4. Attach the decoded payload to the request object
    req.user = decoded;

    // 5. Pass control to the next middleware/controller
    next();
  } catch (error) {
    // Pass the error to your shiny new global error handler
    next(error);
  }
};
