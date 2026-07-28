import { redirect } from "next/navigation";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import { auth } from "@/modules/core/auth";

/*
  El guard de la sección de música, y solo de ella. Hábitos y tareas quedan
  fuera por construcción: se marcan sin sesión, sin red y sin depender de que
  el token de Spotify siga vivo.

  Esto NO protege las server actions del módulo: toda función "use server"
  exportada es un endpoint HTTP invocable directamente, y un layout no la cubre.
  Por eso cada action conserva su propio requireSession().

  Las fuentes y las clases de fondo viven aquí y no en el layout raíz porque
  música y hábitos tienen sistemas visuales distintos. Unificarlos es otro
  sub-proyecto; mientras tanto conviven sin pisarse.
*/

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  // La estética depende de la itálica real de Fraunces; sin `style` next/font
  // solo trae la romana y el navegador sintetiza una itálica falsa.
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

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
    <div
      className={`${fraunces.variable} ${mono.variable} musica-root min-h-full flex flex-col antialiased bg-ink text-cream font-serif selection:bg-acid selection:text-ink`}
    >
      {children}
    </div>
  );
}
