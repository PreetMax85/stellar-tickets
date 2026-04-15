import bcrypt from "bcrypt";
import crypto from "crypto";
import { AuthRepository } from "./auth.repository.js";
import { ApiError } from "../../common/utils/ApiError.js";
import { env } from "../../common/config/env.js";
import {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  verifyRefreshToken,
} from "../../common/utils/jwt.js";
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "./dtos/auth.dto.js";

const SALT_ROUNDS = 10;

export class AuthService {
  static async register(data: RegisterInput) {
    const existingUser = await AuthRepository.findByEmail(data.email);
    if (existingUser) {
      throw ApiError.conflict("A user with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    const newUser = await AuthRepository.createUser(data, hashedPassword);

    const accessToken = generateAccessToken({ userId: newUser.id });
    const refreshToken = generateRefreshToken({ userId: newUser.id });

    return { user: newUser, accessToken, refreshToken };
  }

  static async login(data: LoginInput) {
    const user = await AuthRepository.findByEmail(data.email);

    // Same error message for both "user not found" and "wrong password" —
    // prevents user enumeration attacks (attacker can't tell which one failed)
    if (!user) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const accessToken = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });

     // Explicitly strip sensitive fields before returning user data
    const safeUser = { id: user.id, name: user.name, email: user.email };

    return { user: safeUser, accessToken, refreshToken };
  }

  static async refreshAccess(token: string) {
    // 1. Verify the refresh token (throws ApiError if expired/invalid)
    const decoded = verifyRefreshToken(token);

    // 2. Ensure user still exists in the database
    const user = await AuthRepository.findById(decoded.userId);
    if (!user) {
      throw ApiError.unauthorized("User no longer exists");
    }

    // 3. Token rotation: issue both new tokens so the old refresh token can't be reused
    const newAccessToken = generateAccessToken({ userId: user.id });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  static async forgotPassword(data: ForgotPasswordInput) {
    const user = await AuthRepository.findByEmail(data.email);

    if (!user) {
      return { message: "If an account with that email exists, a password reset link has been sent." };
    }

    const { rawToken, hashedToken, resetTokenExpiresAt } = generateResetToken();

    await AuthRepository.updateResetToken(user.id, hashedToken, resetTokenExpiresAt);

    return {
      message: "If an account with that email exists, a password reset link has been sent.",
      mockEmailContent: `Click here to reset: ${env.APP_URL}/reset?token=${rawToken}`,
    };
  }

  static async resetPassword(data: ResetPasswordInput) {
    const hashedToken = crypto.createHash("sha256").update(data.token).digest("hex");

    const user = await AuthRepository.findByResetToken(hashedToken);
    if (!user) {
      throw ApiError.badRequest("Invalid or expired password reset token");
    }

    const newHashedPassword = await bcrypt.hash(data.newPassword, SALT_ROUNDS);

    await AuthRepository.updatePasswordAndClearToken(user.id, newHashedPassword);

    return { message: "Password has been successfully reset. You can now log in." };
  }
}