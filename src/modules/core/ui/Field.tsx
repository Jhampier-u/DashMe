import { useId } from "react";

/*
  El control va en clases y no en un objeto de estilo, al revés que el resto del
  archivo antes de repintarlo. El motivo es el foco: `:focus` no se puede
  expresar en línea, y un anillo de foco que se ve es un requisito, no un
  adorno. Con todo en utilidades no hay estilo en línea al que ganarle.

  Fondo en paper-2 y no en paper: hundir levemente el campo respecto a la
  tarjeta que lo contiene es lo que lo hace leerse como algo donde se escribe.
  Tinta encima, 9,09:1.
*/
const CONTROL =
  "w-full bg-paper-2 text-tinta font-cuerpo text-[13.5px] " +
  "border-3 border-line rounded-control px-2.5 py-2 " +
  // El marcador de posición es el único sitio donde entra tinta-2 (4,00:1) por
  // debajo de texto grande, y es defendible: nunca lleva información, siempre
  // hay una etiqueta visible al lado y desaparece al escribir.
  "placeholder:text-tinta-2 " +
  "outline-none focus:outline-3 focus:outline-offset-2 focus:outline-line";

/**
 * La etiqueta va en Quicksand, que es la fuente de lo que hay que leer, y en
 * tinta plena: a 12px, tinta-2 se queda en 4,00:1 y eso solo vale para texto
 * grande. La jerarquía con el valor la da el tamaño, no el color.
 */
const ETIQUETA = "block text-xs font-semibold text-tinta font-cuerpo mb-1.5";

type BaseProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
};

/** Campo de una línea. */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  autoFocus,
}: BaseProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={ETIQUETA}>
        {label}
      </label>
      <input
        id={id}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={CONTROL}
      />
    </div>
  );
}

/** Campo de varias líneas. Misma etiqueta y mismo control, distinto alto. */
export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 2,
}: BaseProps & { rows?: number }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={ETIQUETA}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL} resize-y`}
      />
    </div>
  );
}
