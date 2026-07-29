import { varColor } from "@/modules/core/ui/paleta";
import { resolveTagColor, type Tag } from "@/modules/musica/lib/tags";

/**
 * Aquí había un mapa propio de siete entradas apuntando a los `--color-tag-*`
 * de música. Ahora resuelve la clave guardada contra la paleta compartida, que
 * es la misma que usan los hábitos.
 *
 * Sigue aceptando `string` y no `TagColor` a propósito: lo que llega viene de
 * la base de datos, y puede ser una clave vieja que ya no existe.
 */
export function tagColorVar(color: string): string {
  return varColor(resolveTagColor(color));
}

export default function TagBadge({
  tag,
  size = "sm",
  active,
  onClick,
}: {
  tag: Pick<Tag, "name" | "color">;
  size?: "xs" | "sm" | "md";
  active?: boolean;
  onClick?: () => void;
}) {
  const color = tagColorVar(tag.color);
  const sizeClass =
    size === "xs"
      ? "text-[9px] px-1 py-0 leading-4"
      : size === "md"
        ? "text-[11px] px-2 py-1"
        : "text-[10px] px-1.5 py-0.5 leading-4";

  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={`label-mono ring-1 transition-colors normal-case tracking-normal ${sizeClass} ${
        onClick ? "cursor-pointer" : ""
      }`}
      style={{
        color: active ? "var(--color-ink)" : color,
        backgroundColor: active ? color : "transparent",
        borderColor: color,
      }}
    >
      {tag.name}
    </Tag>
  );
}
