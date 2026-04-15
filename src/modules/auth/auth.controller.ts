import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service.js";
import { ApiResponse } from "../../common/utils/ApiResponse.js";
import { ApiError } from "../../common/utils/ApiError.js";
import { env } from "../../common/config/env.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./dtos/auth.dto.js";

// Helper function to set the secure HttpOnly cookie
const setRefreshCookie = (res: Response, token: string) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict", // Prevents CSRF attacks
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export class AuthController {
  static async register(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedData = registerSchema.parse(req.body);
      const { user, accessToken, refreshToken } =
        await AuthService.register(validatedData);

      // Set cookie and remove refreshToken from the response body
      setRefreshCookie(res, refreshToken);
      ApiResponse.created(res, "User registered successfully", {
        user,
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedData = loginSchema.parse(req.body);
      const { user, accessToken, refreshToken } =
        await AuthService.login(validatedData);

      setRefreshCookie(res, refreshToken);
      ApiResponse.ok(res, "Login successful", { user, accessToken });
    } catch (error) {
      next(error);
    }
  }

  static logout = (_req: Request, res: Response) => {
    res.clearCookie("refreshToken");
    res.status(200).json({ success: true, message: "Logged out successfully" });
  };

  static async refresh(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Extract the token directly from cookies instead of the request body
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        throw ApiError.unauthorized("Refresh token is missing");
      }

      const { accessToken, refreshToken: newRefreshToken } =
        await AuthService.refreshAccess(refreshToken);

      // Rotate the token by setting a new cookie
      setRefreshCookie(res, newRefreshToken);
      ApiResponse.ok(res, "Access token refreshed successfully", {
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedData = forgotPasswordSchema.parse(req.body);
      const result = await AuthService.forgotPassword(validatedData);

      const data = result.mockEmailContent
        ? { mockEmailContent: result.mockEmailContent }
        : null;
      ApiResponse.ok(res, result.message, data);
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedData = resetPasswordSchema.parse(req.body);
      const result = await AuthService.resetPassword(validatedData);

      ApiResponse.ok(res, result.message);
    } catch (error) {
      next(error);
    }
  }
}
