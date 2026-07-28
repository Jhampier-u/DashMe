import Link from "next/link";
import { Card } from "@/modules/core/ui/Card";
import { buttonStyle } from "@/modules/core/ui/Button";

export default function NotFound() {
  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: "64px 16px" }}>
      <Card style={{ textAlign: "center", padding: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Esta página no existe
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--m-ink-2)", marginBottom: 20 }}>
          El enlace que has seguido no lleva a ninguna parte.
        </p>
        <Link href="/" style={buttonStyle("primary")}>
          Volver al inicio
        </Link>
      </Card>
    </main>
  );
}
