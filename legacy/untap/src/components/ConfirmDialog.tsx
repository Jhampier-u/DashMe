"use client";

import { useCallback, useRef, useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

type Request = {
  title: string;
  message: string;
  confirmLabel?: string;
};

/**
 * Confirmación propia en vez del `confirm()` del navegador. Devuelve una
 * promesa como el nativo, así que sustituirlo es un cambio de una línea.
 */
export function useConfirm() {
  const [request, setRequest] = useState<Request | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((req: Request) => {
    setRequest(req);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    setRequest(null);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const dismiss = useCallback(() => close(false), [close]);

  const dialog = request ? (
    <Modal
      label={request.title}
      title={request.title}
      onDismiss={dismiss}
      footer={
        <>
          <Button variant="secondary" onClick={dismiss}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => close(true)}>
            {request.confirmLabel ?? "Borrar"}
          </Button>
        </>
      }
    >
      {request.message}
    </Modal>
  ) : null;

  return { confirm, dialog };
}
