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
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Algo se rompió
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--m-ink-2)", marginBottom: 6 }}>
          No hemos podido cargar esta pantalla.
        </p>
        {error.digest ? (
          <p style={{ fontSize: 12, color: "var(--m-ink-3)", marginBottom: 20 }}>
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
