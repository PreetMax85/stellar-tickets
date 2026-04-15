import { Router } from "express";
import { BookingController } from "./booking.controller.js";
import { requireAuth } from "../../common/middleware/authenticate.middleware.js";

const router = Router();

// Public: theater seat map — no auth required
router.get("/seats", BookingController.getSeats);

// Protected: auth required for all booking operations
router.get("/my-bookings", requireAuth, BookingController.getMyBookings);
router.post("/book", requireAuth, BookingController.bookSeat);
router.post("/cancel", requireAuth, BookingController.cancelBooking);

export const bookingRoutes = router;
