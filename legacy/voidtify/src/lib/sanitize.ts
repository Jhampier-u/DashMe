// Las descripciones de Spotify (incluidas las de playlists de OTROS usuarios)
// pueden traer HTML. Renderizarlas con dangerouslySetInnerHTML es un vector XSS.
// Esta util las convierte a texto plano seguro: quita etiquetas y decodifica
// las entidades comunes, para interpolarlas con normalidad en JSX (React ya
// escapa el resultado).

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function sanitizeDescription(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, "") // quita cualquier etiqueta
    .replace(/&#(\d+);/g, (_, n) => codePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => codePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => NAMED_ENTITIES[m.toLowerCase()] ?? m)
    .trim();
}

function codePoint(n: number): string {
  return Number.isFinite(n) && n >= 0 && n <= 0x10ffff
    ? String.fromCodePoint(n)
    : "";
}
