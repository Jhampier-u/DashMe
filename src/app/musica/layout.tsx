import { redirect } from "next/navigation";
import { auth } from "@/modules/core/auth";

/*
  El guard de la sección de música, y solo de ella. Hábitos y tareas quedan
  fuera por construcción: se marcan sin sesión, sin red y sin depender de que
  el token de Spotify siga vivo.

  Esto NO protege las server actions del módulo: toda función "use server"
  exportada es un endpoint HTTP invocable directamente, y un layout no la cubre.
  Por eso cada action conserva su propio requireSession().

  Las fuentes ya no viven aquí. Música tenía las suyas —Fraunces y JetBrains
  Mono— porque era un sistema visual aparte; ahora usa las tres del sistema, que
  carga el layout raíz.
*/

export default async function MusicaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.accessToken) {
    redirect("/api/auth/signin?callbackUrl=/musica");
  }

  return (
    // `selection:text-tinta` y no `text-ink`: `ink` es ahora el papel, así que
    // sobre una selección amarilla quedaría claro sobre claro.
    <div className="musica-root min-h-full flex flex-col antialiased bg-ink text-cream font-serif selection:bg-acid selection:text-tinta">
      {children}
    </div>
  );
}
