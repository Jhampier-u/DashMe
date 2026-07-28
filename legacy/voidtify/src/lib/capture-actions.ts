"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "./require-session";
import { runCapture, type CaptureResult } from "./capture/run-capture";

/**
 * Ejecución manual desde /ajustes.
 *
 * Toda action exportada es un endpoint HTTP público, así que exige sesión
 * (mismo patrón que el resto de actions del proyecto).
 */
export async function capturarAhora(): Promise<CaptureResult> {
  await requireSession();
  const resultado = await runCapture(true);
  revalidatePath("/ajustes");
  return resultado;
}
