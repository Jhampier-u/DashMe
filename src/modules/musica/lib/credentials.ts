import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/modules/core/db";
import { spotifyCredentials, type SpotifyCredentialsRow } from "@/modules/musica/schema";

/** La tabla tiene una sola fila, con id fijo. */
const FILA = 1;

export type CredentialsInput = {
  spotifyUserId: string;
  refreshToken: string;
  accessToken?: string | null;
  expiresAt?: number | null;
};

/**
 * Guarda (o reemplaza) las credenciales. Se llama al iniciar sesión por
 * navegador; es lo que permite que el cron opere después sin cookie.
 */
export async function saveCredentials(input: CredentialsInput): Promise<void> {
  const now = Date.now();
  await db
    .insert(spotifyCredentials)
    .values({
      id: FILA,
      spotifyUserId: input.spotifyUserId,
      refreshToken: input.refreshToken,
      accessToken: input.accessToken ?? null,
      expiresAt: input.expiresAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: spotifyCredentials.id,
      set: {
        spotifyUserId: input.spotifyUserId,
        refreshToken: input.refreshToken,
        accessToken: input.accessToken ?? null,
        expiresAt: input.expiresAt ?? null,
        updatedAt: now,
      },
    });
}

export async function getCredentials(): Promise<SpotifyCredentialsRow | null> {
  const filas = await db
    .select()
    .from(spotifyCredentials)
    .where(eq(spotifyCredentials.id, FILA))
    .limit(1);
  return filas[0] ?? null;
}

/** Actualiza solo el access token tras un refresco. */
export async function updateAccessToken(
  accessToken: string,
  expiresAt: number,
  refreshToken?: string,
): Promise<void> {
  await db
    .update(spotifyCredentials)
    .set({
      accessToken,
      expiresAt,
      ...(refreshToken ? { refreshToken } : {}),
      updatedAt: Date.now(),
    })
    .where(eq(spotifyCredentials.id, FILA));
}
