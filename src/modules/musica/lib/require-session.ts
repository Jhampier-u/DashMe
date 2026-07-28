import "server-only";
import { auth } from "@/modules/core/auth";

/**
 * Guard de autorización para Server Actions.
 *
 * Toda función `"use server"` exportada es un endpoint HTTP público (POST con
 * action-id) que puede invocarse directamente, no solo desde la UI. Las actions
 * que tocan la DB local deben llamar a esto primero para no quedar abiertas.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.accessToken) throw new Error("No autenticado");
  return session;
}
