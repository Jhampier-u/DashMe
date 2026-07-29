"use client";

import { useEffect } from "react";
import { Card } from "@/modules/core/ui/Card";
import { Button } from "@/modules/core/ui/Button";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: "64px 16px" }}>
      <Card style={{ textAlign: "center", padding: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 14,
            overflowWrap: "anywhere",
          }}
        >
          Algo se rompió
        </h2>
        <p style={{ fontSize: 13.5, marginBottom: 6 }}>
          No hemos podido cargar esta pantalla.
        </p>
        {error.digest ? (
          // El código es un dato, así que va en VT323, a su suelo de 16px.
          <p style={{ fontFamily: "var(--font-vt)", fontSize: 16, marginBottom: 20 }}>
            Código: {error.digest}
          </p>
        ) : (
          <div style={{ height: 14 }} />
        )}
        <Button variant="primary" onClick={() => unstable_retry()}>
          Reintentar
        </Button>
      </Card>
    </main>
  );
}
