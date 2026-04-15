import { z } from "zod";

export const bookSeatSchema = z.object({
  seatId: z.number().int().positive("Seat ID must be a positive integer"),
  movieId: z.number().int().positive("Movie ID must be a positive integer"),
});

export const cancelBookingSchema = z.object({
  bookingId: z.number().int().positive("Booking ID must be a positive integer"),
});

export type BookSeatInput = z.infer<typeof bookSeatSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;