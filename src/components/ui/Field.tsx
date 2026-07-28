import { useId, type CSSProperties } from "react";

const CONTROL: CSSProperties = {
  width: "100%",
  background: "var(--m-page)",
  border: "1px solid var(--m-line)",
  borderRadius: 8,
  padding: "9px 11px",
  fontFamily: "inherit",
  fontSize: 13.5,
  color: "var(--m-ink)",
  outline: "none",
};

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
      <label
        htmlFor={id}
        style={{ display: "block", fontSize: 12, color: "var(--m-ink-2)", marginBottom: 6 }}
      >
        {label}
      </label>
      <input
        id={id}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        style={CONTROL}
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
      <label
        htmlFor={id}
        style={{ display: "block", fontSize: 12, color: "var(--m-ink-2)", marginBottom: 6 }}
      >
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...CONTROL, resize: "vertical" }}
      />
    </div>
  );
}
