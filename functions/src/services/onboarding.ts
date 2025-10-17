import { getOnboarding, findUserByEmailLower, createMappingForUser } from "../adapters/firestore";
import { extractEmail } from "../utils/parse";
import { config } from "../config";

const TIMEOUT_MS = config.onboardingTimeoutMinutes * 60 * 1000;

function isExpired(createdAt?: number) {
  if (!createdAt) return true;
  return (Date.now() - createdAt) > TIMEOUT_MS;
}

/**
 * Proactive, stateful onboarding:
 * - If no session: create "awaiting_email"
 * - If expired: reset state and start over
 * - If awaiting_email: parse email, verify pro, map, finish
 * - Attempts are tracked; after 5 attempts, reset session
 */
export async function handleOnboardingStep(phone: string, body: string): Promise<{done: boolean, message: string}> {
  const { exists, data, ref } = await getOnboarding(phone);

  // Start or reset if missing/expired
  if (!exists || isExpired(data?.createdAt)) {
    await ref.set({ status: "awaiting_email", createdAt: Date.now(), attempts: 0 });
    return {
      done: false,
      message: "Hi! To link your Zporter Pro account, please reply with the email you use for Zporter."
    };
  }

  const status = data?.status;
  const attempts = Number.isFinite(data?.attempts) ? data?.attempts : 0;

  // Safety: too many failed attempts => reset
  if (attempts >= 5) {
    await ref.set({ status: "awaiting_email", createdAt: Date.now(), attempts: 0 }, { merge: true });
    return {
      done: false,
      message: "Let's start over. Please reply with the email you use for Zporter (e.g., coach@example.com)."
    };
  }

  if (status === "awaiting_email") {
    const email = extractEmail(body || "");
    if (!email) {
      await ref.set({ ...data, attempts: attempts + 1, lastError: "invalid_email" }, { merge: true });
      return {
        done: false,
        message: "Sorry, I didn’t detect a valid email. Please reply with your email address (e.g., coach@example.com)."
      };
    }

    const user = await findUserByEmailLower(email);
    if (!user || user.proSubscriptionStatus !== "active") {
      await ref.set({ ...data, attempts: attempts + 1, lastError: "not_pro", lastTriedEmail: email }, { merge: true });
      return {
        done: false,
        message: "I couldn't verify a Pro account with that email. Ensure your Pro is active, or try a different email."
      };
    }

    await createMappingForUser(user.id, phone);
    await ref.delete();
    return {
      done: true,
      message: "✅ Your WhatsApp is now linked to your Zporter Pro account. How can I help you today?"
    };
  }

  // Unknown state => reset
  await ref.set({ status: "awaiting_email", createdAt: Date.now(), attempts: 0 }, { merge: true });
  return {
    done: false,
    message: "Let’s start over. Please reply with the email you use for Zporter."
  };
}
