// just GET /movies
import { Router, Request, Response, NextFunction } from "express";
import { MoviesRepository } from "./movies.repository.js";
import { ApiResponse } from "../../common/utils/ApiResponse.js";

const router = Router();

// GET /api/movies
// Directly calls the repository since there is no complex business logic required
router.get(
  "/",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const allMovies = await MoviesRepository.getAllMovies();
      // Return using our strictly typed ApiResponse utility!
      ApiResponse.ok(res, "Movies fetched successfully", allMovies);
    } catch (error) {
      next(error);
    }
  },
);

export const moviesRoutes = router;
