import { db } from "./index.js";
import { movies, seats } from "./schema.js";
import { sql } from "drizzle-orm";

const SEAT_COUNT = 60;

const MOVIES = [

  { title: "Dhurandhar",
    language: "Hindi",
    duration: 214,
    posterUrl: "/images/dhurandhar.jpeg"
  },
  { title: "KGF Chapter 2",
    language: "Hindi",
    duration: 166,
    posterUrl: "/images/kgf2.jpg"
  },
  { title: "Pushpa 2",
    language: "Telugu",
    duration: 200,
    posterUrl: "/images/pushpa2.jpg"
  },
  {
    title: "Oppenheimer",
    language: "English",
    duration: 180,
    posterUrl: "/images/oppenheimer.jpg",
  },
  {
    title: "Tenet",
    language: "English",
    duration: 150,
    posterUrl: "/images/tenet.jpg",
  },
  {
    title: "Dune: Part Two",
    language: "English",
    duration: 166,
    posterUrl: "/images/dune2.jpg",
  },
  {
    title: "Inside Out 2",
    language: "English",
    duration: 96,
    posterUrl: "/images/insideout2.jpeg",
  },
  {
    title: "Deadpool & Wolverine",
    language: "English",
    duration: 128,
    posterUrl: "/images/deadpoolwolverine.jpg",
  },
  {
    title: "Jawan",
    language: "Hindi",
    duration: 169,
    posterUrl: "/images/jawan.jpeg",
  },
  {
    title: "Pathaan",
    language: "Hindi",
    duration: 146,
    posterUrl: "/images/pathaan.jpg",
  },
];

async function seed() {
  console.log("[Seed] Starting...");

  // Movies
  // onConflictDoNothing so re-runs don't duplicate or throw
  const insertedMovies = await db
    .insert(movies)
    .values(MOVIES)
    .onConflictDoNothing()
    .returning({ id: movies.id, title: movies.title });

  if (insertedMovies.length === 0) {
    console.log("[Seed] Movies already exist — skipping.");
  } else {
    console.log(`[Seed] Inserted ${insertedMovies.length} movie(s).`);
  }

  // Seats
  // Check first so we don't insert 60 more seats on every re-run
  const existingSeats = await db
    .select({ count: sql<number>`count(*)` })
    .from(seats);

  const seatCount = Number(existingSeats[0]?.count ?? 0);

  if (seatCount >= SEAT_COUNT) {
    console.log(`[Seed] ${seatCount} seat(s) already exist — skipping.`);
  } else {
    // Insert only the missing seats (handles partial seeds too)
    const toInsert = SEAT_COUNT - seatCount;
    await db
      .insert(seats)
      .values(Array.from({ length: toInsert }, () => ({ isBooked: 0 })));
    console.log(`[Seed] Inserted ${toInsert} seat(s).`);
  }

  console.log("[Seed] Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[Seed] Failed:", err);
  process.exit(1);
});