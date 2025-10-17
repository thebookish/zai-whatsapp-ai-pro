
import { findProUserByPhone } from "../adapters/firestore";
import { ProUser } from "../types";

export async function authorizeUserByPhone(phone: string): Promise<ProUser | null> {
  return await findProUserByPhone(phone);
}
