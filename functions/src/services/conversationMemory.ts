/**
 * conversationMemory.ts
 * ---------------------------------------
 * Lightweight in-memory conversational memory
 * for Zai’s context-aware chat continuity.
 *
 *  Purpose:
 *   - Tracks the most recent entity the user asked about
 *     (player, coach, team, or match).
 *   - Enables natural follow-up questions using pronouns
 *     (e.g., “his coach”, “their formation”).
 *   - Expires automatically after 30 minutes of inactivity.
 *
 *  Design:
 *   - Uses a Map keyed by session ID.
 *   - Simple to replace with Firestore or Redis if persistence is needed.
 */

export type MemoryEntityType = "player" | "coach" | "team" | "match";

export type MemoryEntry = {
  type: MemoryEntityType;
  name: string;
  id?: string;
  timestamp: number;
};

//  Memory expiry (30 minutes)
const MEMORY_TIMEOUT_MS = 30 * 60 * 1000;

// In-memory session memory
const memoryStore = new Map<string, MemoryEntry>();

/**
 * Get the current memory for a given session (if not expired)
 */
export function getMemory(sessionId: string): MemoryEntry | null {
  const entry = memoryStore.get(sessionId);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > MEMORY_TIMEOUT_MS) {
    memoryStore.delete(sessionId);
    return null;
  }
  return entry;
}

/**
 * Save or update memory for a user session
 */
export function setMemory(
  sessionId: string,
  type: MemoryEntityType,
  name: string,
  id?: string
) {
  const entry: MemoryEntry = {
    type,
    name,
    id,
    timestamp: Date.now(),
  };
  memoryStore.set(sessionId, entry);
}

/**
 * Clear memory manually (e.g., after onboarding or timeout)
 */
export function clearMemory(sessionId: string) {
  memoryStore.delete(sessionId);
}

/**
 * (Optional) Clean up expired memory entries periodically.
 * Useful in long-running servers to prevent leaks.
 */
export function cleanupExpiredMemory() {
  const now = Date.now();
  for (const [sessionId, entry] of memoryStore.entries()) {
    if (now - entry.timestamp > MEMORY_TIMEOUT_MS) {
      memoryStore.delete(sessionId);
    }
  }
}

// Auto-clean every 10 minutes
setInterval(cleanupExpiredMemory, 10 * 60 * 1000).unref();
