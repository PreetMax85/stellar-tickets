import { eq, and } from "drizzle-orm";
import { db } from "../../common/db/index.js";
import { seats, bookings, movies, users } from "../../common/db/schema.js";

// Typed error constants — shared with service layer so there are no magic strings
// anywhere in the codebase. If you rename one, TypeScript catches every usage.
export const BookingError = {
  SEAT_UNAVAILABLE: "SEAT_UNAVAILABLE",
  NOT_AUTHORIZED_OR_NOT_FOUND: "NOT_AUTHORIZED_OR_NOT_FOUND",
  BOOKING_NOT_FOUND: "BOOKING_NOT_FOUND",
} as const;

export type BookingErrorCode = (typeof BookingError)[keyof typeof BookingError];

export class BookingRepository {
  // 1. Fetch all seats for the theater map
  static async getAllSeats() {
    return await db
      .select({
        id: seats.id,
        isBooked: seats.isBooked,
        userId: seats.userId,
        bookedAt: seats.bookedAt,
        name: users.name, // Extracted securely from the joined users table!
      })
      .from(seats)
      .leftJoin(users, eq(seats.userId, users.id))
      .orderBy(seats.id);
  }

  // 2. Fetch a user's booking history — joined with seat and movie
  //    so the response is actually useful to a frontend (not just IDs)
  static async getUserBookings(userId: number) {
    return await db
      .select({
        bookingId: bookings.id,
        status: bookings.status,
        bookedAt: bookings.bookedAt,
        seat: {
          id: seats.id,
        },
        movie: {
          id: movies.id,
          title: movies.title,
          language: movies.language,
          duration: movies.duration,
        },
      })
      .from(bookings)
      .innerJoin(seats, eq(bookings.seatId, seats.id))
      .innerJoin(movies, eq(bookings.movieId, movies.id))
      .where(eq(bookings.userId, userId))
      .orderBy(bookings.bookedAt);
  }

  // 3. Atomic transaction for booking a seat
  static async bookSeatTransaction(
    seatId: number,
    userId: number,
    movieId: number,
  ) {
    return await db.transaction(async (tx) => {
      // Lock + update the seat atomically.
      // WHERE isBooked = 0 ensures only one concurrent request wins.
      // PostgreSQL guarantees only one UPDATE succeeds when two race on the same row.
      const [lockedSeat] = await tx
        .update(seats)
        .set({
          isBooked: 1,
          userId,
          bookedAt: new Date(),
        })
        .where(and(eq(seats.id, seatId), eq(seats.isBooked, 0)))
        .returning();

      if (!lockedSeat) {
        throw new Error(BookingError.SEAT_UNAVAILABLE);
      }

      // Create the permanent booking ledger entry
      const [bookingRecord] = await tx
        .insert(bookings)
        .values({ seatId, userId, movieId, status: "confirmed" })
        .returning();

      return { seat: lockedSeat, booking: bookingRecord };
    });
  }

  // 4. Atomic transaction for cancelling a booking
  static async cancelBookingTransaction(bookingId: number, userId: number) {
    return await db.transaction(async (tx) => {
      // Step A: Find and cancel the booking — verify ownership in the same query
      const [cancelledBooking] = await tx
        .update(bookings)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.userId, userId), // ownership check
            eq(bookings.status, "confirmed"), // can't cancel an already-cancelled booking
          ),
        )
        .returning();

      // If nothing was updated, either booking doesn't exist or user doesn't own it
      if (!cancelledBooking) {
        throw new Error(BookingError.NOT_AUTHORIZED_OR_NOT_FOUND);
      }

      // Step B: Free the seat so others can book it
      await tx
        .update(seats)
        .set({ isBooked: 0, userId: null, bookedAt: null })
        .where(eq(seats.id, cancelledBooking.seatId));

      return cancelledBooking;
    });
  }
}
