import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/modules/core/shell/AppShell";
import { AchievementToast } from "@/modules/habitos/components/AchievementToast";
import { SoundEffects } from "@/modules/habitos/components/SoundEffects";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Mis apps, hábitos y música en un solo sitio",
};

// AchievementToast y SoundEffects son de hábitos y están en el layout global.
// Es deuda consciente: cuando entre música habrá que decidir si suben a core o
// bajan a un layout de sección. Hoy no molesta porque solo hay un módulo.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full">
        <AchievementToast />
        <SoundEffects />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
