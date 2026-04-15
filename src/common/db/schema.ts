import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

// Movies Table
export const movies = pgTable("movies", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull().unique(),
  language: varchar("language", { length: 50 }).notNull(),
  duration: integer("duration").notNull(), // in minutes
  posterUrl: varchar("poster_url", { length: 500 }), 
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users Table 
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(), // bcrypt hash

  resetToken: varchar("reset_token", { length: 255 }),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});


// Seats Table
export const seats = pgTable("seats", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }), // kept for backward-compat with starter's PUT /:id/:name
  isBooked: integer("isbooked").default(0).notNull(), // 0 = available, 1 = booked
  userId: integer("user_id").references(() => users.id), // null until booked
  bookedAt: timestamp("booked_at"), // null until booked — NOT defaultNow()
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

//  Bookings Table
// Separate from seats so we get proper history, cancellation support, and a real user
export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    seatId: integer("seat_id")
      .references(() => seats.id)
      .notNull(),
    movieId: integer("movie_id")
      .references(() => movies.id)
      .notNull(),
    status: varchar("status", { length: 20 }).default("confirmed").notNull(), // confirmed | cancelled
    bookedAt: timestamp("booked_at").defaultNow().notNull(),
  },
    (t) => ({
    // We use a partial index so it only locks 'confirmed' seats, allowing cancellations.
    uniqueSeatMovie: uniqueIndex("unique_seat_movie_idx")
      .on(t.seatId, t.movieId)
      .where(sql`status = 'confirmed'`),
  })
);