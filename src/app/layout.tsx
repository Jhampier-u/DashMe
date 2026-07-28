import type { Metadata } from "next";
import { Press_Start_2P, Quicksand, VT323 } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/modules/core/shell/AppShell";
import { AchievementToast } from "@/modules/habitos/components/AchievementToast";
import { SoundEffects } from "@/modules/habitos/components/SoundEffects";

/*
  Las tres fuentes del sistema pixel-kawaii, cada una con su papel: Press Start
  2P para títulos, VT323 para datos y Quicksand para lo que hay que leer. Que
  sean tres y no una es justo lo que evita que el pixel canse.

  Ninguna es variable, así que `weight` es obligatorio en las dos pixeladas;
  Quicksand sí lo es y por eso no lo lleva.

  Las variables se llaman como la fuente, no como el token: el alias por el que
  se usan (`--font-pixel`, `--font-vt`, `--font-cuerpo`) vive en `tokens.css` y
  apunta a estas. Si compartieran nombre, una taparía a la otra. Es el mismo
  reparto que música hace con Fraunces y JetBrains.

  Estas tres van en el layout raíz —y no en uno de sección como las de música—
  porque `--font-cuerpo` es la familia por defecto del documento entero. Las
  variables solo declaran las familias: aplicarlas es cosa de cada componente.
*/
const pixel = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const vt = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const cuerpo = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  display: "swap",
});

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
    <html
      lang="es"
      className={`${pixel.variable} ${vt.variable} ${cuerpo.variable} h-full`}
    >
      <body className="min-h-full">
        <AchievementToast />
        <SoundEffects />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
