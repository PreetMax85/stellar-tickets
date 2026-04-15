import { BookingRepository, BookingError } from "./booking.repository.js";
import { ApiError } from "../../common/utils/ApiError.js";
import { BookSeatInput, CancelBookingInput } from "./dtos/booking.dto.js";

export class BookingService {
  static async getAllSeats() {
    return await BookingRepository.getAllSeats();
  }

  static async getUserBookings(userId: number) {
    return await BookingRepository.getUserBookings(userId);
  }

  static async bookSeat(userId: number, data: BookSeatInput) {
    try {
      return await BookingRepository.bookSeatTransaction(
        data.seatId,
        userId,
        data.movieId,
      );
    } catch (error) {
      // Type-safe error handling — no more `error: any`
      if (error instanceof Error && error.message === BookingError.SEAT_UNAVAILABLE) {
        throw ApiError.conflict("Seat is already booked or does not exist");
      }
      throw error;
    }
  }

  static async cancelBooking(userId: number, data: CancelBookingInput) {
    try {
      await BookingRepository.cancelBookingTransaction(data.bookingId, userId);
      return { message: "Booking cancelled successfully" };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === BookingError.NOT_AUTHORIZED_OR_NOT_FOUND
      ) {
        throw ApiError.forbidden(
          "You do not have permission to cancel this booking, or it does not exist",
        );
      }
      throw error;
    }
  }
}