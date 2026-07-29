import Link from "next/link";
import { Card } from "@/modules/core/ui/Card";
import { buttonStyle } from "@/modules/core/ui/Button";

export default function NotFound() {
  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: "64px 16px" }}>
      <Card style={{ textAlign: "center", padding: 32 }}>
        {/* Cuatro palabras, que es el máximo del spec para Press Start 2P. */}
        <h2
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 14,
            overflowWrap: "anywhere",
          }}
        >
          Esta página no existe
        </h2>
        <p style={{ fontSize: 13.5, marginBottom: 20 }}>
          El enlace que has seguido no lleva a ninguna parte.
        </p>
        <Link href="/" style={buttonStyle("primary")}>
          Volver al inicio
        </Link>
      </Card>
    </main>
  );
}
