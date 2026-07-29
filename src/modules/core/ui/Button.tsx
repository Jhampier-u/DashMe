import type { ButtonHTMLAttributes, CSSProperties } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRadius: "var(--radius-control)",
  fontFamily: "var(--font-cuerpo)",
  fontWeight: 700,
  lineHeight: 1.2,
  cursor: "pointer",
  border: "3px solid var(--color-line)",
  boxShadow: "var(--shadow-hard)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const SIZES: Record<ButtonSize, CSSProperties> = {
  sm: { fontSize: 12.5, padding: "5px 10px" },
  md: { fontSize: 13.5, padding: "8px 15px" },
};

/*
  Los acentos se reparten por oficio, y ese reparto es la decisión de sistema
  que más se va a notar más adelante:

    lav · mint · sky     identidad de hábito  (ACENTOS_HABITO)
    pink · peach · yellow armazón de la interfaz

  Por eso los botones tiran de rosa y peach y no de cielo: en la pantalla de
  hábitos, un botón celeste junto a una fila cuyo acento ES celeste haría que el
  color dejara de significar nada.

  `pink` para la acción principal: es el acento de la marca y el que más se
  repite en el dashboard;
  `peach` es el extremo cálido de la paleta y es lo más parecido a una alarma
  que hay aquí. No hay rojo: la paleta pastel no lo tiene y la regla dura impide
  compensarlo con texto de color. Gritar es trabajo de `CriticalBanner`, no de
  un botón.

  El texto va SIEMPRE en tinta, nunca en el pastel. Contrastes de tinta sobre
  cada fondo, medidos en `contraste.ts`: rosa 5,43:1 · peach 7,64:1 ·
  paper 9,76:1. Los tres pasan AA de sobra.
*/
const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "var(--color-pink)", color: "var(--color-tinta)" },
  secondary: { background: "var(--color-paper)", color: "var(--color-tinta)" },
  ghost: {
    background: "transparent",
    color: "var(--color-tinta)",
    border: "3px solid transparent",
    boxShadow: "none",
  },
  danger: { background: "var(--color-peach)", color: "var(--color-tinta)" },
};

/**
 * Estilos sueltos, para elementos que no son `<button>` — un `<Link>` con
 * aspecto de botón, por ejemplo.
 *
 * Devuelve el aspecto en reposo, no el hundido: el desplazamiento al pulsar
 * vive en las clases de `<Button>`, porque un objeto de estilo no puede
 * expresar `:active`.
 */
export function buttonStyle(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
): CSSProperties {
  return { ...BASE, ...SIZES[size], ...VARIANTS[variant] };
}

/*
  La tecla. Al pulsar, el botón se mueve 2px hacia la sombra y la sombra se
  encoge a 2px: el conjunto se hunde sin moverse de sitio. Es lo que le da la
  sensación física, y es la interacción más repetida de la aplicación.

  El `!` de la sombra no es pereza. `buttonStyle()` la pone como estilo en
  línea para que un `<Link>` también la tenga, y ningún selector de clase gana a
  un estilo en línea. El desplazamiento no lo necesita porque nadie declara
  `transform` en línea.

  El movimiento reducido ya está cubierto: `globals.css` anula las transiciones
  bajo `prefers-reduced-motion`. El botón sigue hundiéndose, solo que sin
  interpolar — que es justo lo que hay que conservar, porque es respuesta a una
  pulsación y no decoración.
*/
const TECLA =
  "transition-[transform,box-shadow] duration-75 ease-out " +
  "active:translate-x-0.5 active:translate-y-0.5 " +
  "active:shadow-[2px_2px_0_var(--color-line)]!";

const FOCO =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "secondary",
  size = "md",
  style,
  className,
  disabled,
  type = "button",
  ...rest
}: Props) {
  // `ghost` no lleva sombra, así que tampoco se hunde: encogerle una sombra que
  // no tiene se la inventaría al pulsar. Deshabilitado tampoco responde.
  const hundible = !disabled && variant !== "ghost";

  return (
    <button
      type={type}
      disabled={disabled}
      className={[hundible ? TECLA : null, FOCO, className]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...buttonStyle(variant, size),
        ...(disabled ? { opacity: 0.5, cursor: "default" } : null),
        ...style,
      }}
      {...rest}
    />
  );
}
