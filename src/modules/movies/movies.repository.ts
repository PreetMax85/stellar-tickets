// one query, return all movies
import { db } from "../../common/db/index.js";
import { movies } from "../../common/db/schema.js";

export class MoviesRepository {
  static async getAllMovies() {
    return await db.select().from(movies).orderBy(movies.id);
  }
}