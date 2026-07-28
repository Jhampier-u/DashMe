import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { AchievementToast } from "@/components/AchievementToast";
import { SoundEffects } from "@/components/SoundEffects";

export const metadata: Metadata = {
  title: "Untap",
  description: "Untap — hábitos, tareas y proyectos",
};

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
