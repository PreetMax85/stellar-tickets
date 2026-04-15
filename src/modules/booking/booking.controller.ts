import { Response, NextFunction } from "express";
import { BookingService } from "./booking.service.js";
import { ApiResponse } from "../../common/utils/ApiResponse.js";
import { AuthRequest } from "../../common/middleware/authenticate.middleware.js";
import { ApiError } from "../../common/utils/ApiError.js";
import { bookSeatSchema, cancelBookingSchema } from "./dtos/booking.dto.js";

export class BookingController {
  // Public route: anyone can see the theater seat map
  static async getSeats(
    _req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const seats = await BookingService.getAllSeats();
      ApiResponse.ok(res, "Theater seats fetched successfully", seats);
    } catch (error) {
      next(error);
    }
  }

  // Protected: returns the authenticated user's booking history (joined with seat + movie)
  static async getMyBookings(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) throw ApiError.unauthorized();

      const bookings = await BookingService.getUserBookings(userId);
      ApiResponse.ok(res, "User bookings fetched successfully", bookings);
    } catch (error) {
      next(error);
    }
  }

  // Protected: book a seat for a movie
  static async bookSeat(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) throw ApiError.unauthorized();

      const validatedData = bookSeatSchema.parse(req.body);
      const result = await BookingService.bookSeat(userId, validatedData);

      ApiResponse.created(res, "Seat booked successfully", result);
    } catch (error) {
      next(error);
    }
  }

  // Protected: cancel a booking by bookingId
  static async cancelBooking(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) throw ApiError.unauthorized();

      const validatedData = cancelBookingSchema.parse(req.body);
      const result = await BookingService.cancelBooking(userId, validatedData);

      ApiResponse.ok(res, result.message);
    } catch (error) {
      next(error);
    }
  }
}
