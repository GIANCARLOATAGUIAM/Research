import "server-only";

type DbError = { code?: string; message: string };

// Error codes raised on purpose by WUPCare's database functions and triggers.
// Their messages are written for users (supabase/migrations/0004-0007).
const READABLE = new Set(["P0001", "P0002", "22023"]);

/**
 * Turns a Supabase/Postgres error into a message that is safe to show.
 * Unexpected errors are logged on the server and replaced with a generic
 * message, so SQL details never reach the browser (SYSTEM_SPEC §12.9).
 */
export function dbErrorMessage(error: DbError, fallback = "Could not save. Please try again.") {
  if (error.code && READABLE.has(error.code)) return error.message;
  if (error.code === "42501") {
    return error.message === "Not allowed." || error.message.startsWith("permission denied") || error.message.includes("row-level security")
      ? "You do not have permission to do that."
      : error.message;
  }
  if (error.code === "23505") return "This record already exists.";
  if (error.code === "23514") return "Some values are not allowed. Check the form and try again.";
  if (error.code === "23503") return "A linked record does not match. Check the student, visit, or incident.";
  console.error("[db]", error.code, error.message);
  return fallback;
}

export function isUniqueViolation(error: DbError, constraint: string) {
  return error.code === "23505" && error.message.includes(constraint);
}
