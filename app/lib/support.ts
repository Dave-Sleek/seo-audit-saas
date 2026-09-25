// app/lib/support.ts

import { randomBytes } from "crypto";

/**
 * Generate a short human-readable ticket reference, e.g. "TKT-7F3A".
 *
 * 4 characters of base32 gives ~1M combinations. Collisions are
 * vanishingly rare at any realistic volume, and the unique index
 * on `reference` catches them if they happen.
 */
export function generateTicketReference(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1
  const bytes = randomBytes(4);

  let suffix = "";

  for (let i = 0; i < 4; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }

  return `TKT-${suffix}`;
}