import { eq, and, gt  } from "drizzle-orm";
import { db } from "../../common/db/index.js";
import { users } from "../../common/db/schema.js";
import { RegisterInput } from "./dtos/auth.dto.js";
import { ApiError } from "../../common/utils/ApiError.js";

export class AuthRepository {
  // Returns full user including password hash — never send this directly to client
  static async findByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  // Returns only safe fields — used in refreshAccess to verify user still exists.
  // Deliberately excludes password hash since it's not needed for existence checks.

  static async findById(id: number) {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  // DB-level expiry check via gt() — if the token is expired or null,
  // this returns undefined. The service layer does not need to re-check expiry.
  static async findByResetToken(hashedToken: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.resetToken, hashedToken),
          gt(users.resetTokenExpiresAt, new Date())
        )
      )
      .limit(1);
    return user;
  }

  static async createUser(data: RegisterInput, hashedPassword: string) {
    const [newUser] = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        password: hashedPassword,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
      });

    // Existence check to satisfy noUncheckedIndexedAccess
    if (!newUser) {
      throw ApiError.internal("Failed to create user record");
    }

    return newUser;
  }

  static async updateResetToken(userId: number, token: string, expiresAt: Date) {
    await db
      .update(users)
      .set({
        resetToken: token,
        resetTokenExpiresAt: expiresAt,
      })
      .where(eq(users.id, userId));
  }

  static async updatePasswordAndClearToken(userId: number, newHashedPassword: string) {
    await db
      .update(users)
      .set({
        password: newHashedPassword,
        resetToken: null,
        resetTokenExpiresAt: null,
      })
      .where(eq(users.id, userId));
  }
}