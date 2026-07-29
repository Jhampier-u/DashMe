// Iconos de trazo propios. Sin librería: son seis figuras de una línea cada
// una y una dependencia menos que mantener.

import type { SVGProps } from "react";

type IconProps = { className?: string };

const SHARED: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  // 2,5 y no 3: el sistema traza a 3px en todo lo demás, pero a 24×24 ese
  // grosor cierra los huecos interiores de la casa y la carpeta y las convierte
  // en manchas. 2,5 aguanta junto a un borde macizo sin perder el dibujo.
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconHome({ className }: IconProps) {
  return (
    <svg {...SHARED} className={className}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

export function IconHabits({ className }: IconProps) {
  return (
    <svg {...SHARED} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconGarden({ className }: IconProps) {
  return (
    <svg {...SHARED} className={className}>
      <path d="M12 21v-7" />
      <path d="M12 14c0-3 2-5 5-5 0 3-2 5-5 5Z" />
      <path d="M12 14c0-3-2-5-5-5 0 3 2 5 5 5Z" />
    </svg>
  );
}

export function IconTasks({ className }: IconProps) {
  return (
    <svg {...SHARED} className={className}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function IconProjects({ className }: IconProps) {
  return (
    <svg {...SHARED} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

export function IconMusic({ className }: IconProps) {
  return (
    <svg {...SHARED} className={className}>
      <path d="M9 18V5l12-2v13" />
      <path d="M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path d="M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}
