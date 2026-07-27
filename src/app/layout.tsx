import type { Metadata } from "next";
import { VT323, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { AchievementToast } from "@/components/AchievementToast";
import { SoundEffects } from "@/components/SoundEffects";

const vt323 = VT323({
  weight: "400",
  variable: "--font-vt323",
  subsets: ["latin"],
});

const pressStart = Press_Start_2P({
  weight: "400",
  variable: "--font-press-start",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Untap",
  description: "Untap — hábitos, tareas y proyectos al estilo pixel art",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${vt323.variable} ${pressStart.variable} h-full`}
    >
      <body className="min-h-full">
        <AchievementToast />
        <SoundEffects />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
