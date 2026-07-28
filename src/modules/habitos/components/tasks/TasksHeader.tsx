"use client";

import { useState } from "react";
import { PageHeader } from "@/modules/core/ui/PageHeader";
import { Button } from "@/modules/core/ui/Button";
import { NewTaskForm } from "./NewTaskForm";

/**
 * Cabecera y formulario de creación. Viven juntos porque comparten el estado
 * de abierto: el botón va en la cabecera y el formulario debajo, a todo el
 * ancho de la pantalla.
 */
export function TasksHeader({ total }: { total: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Tareas"
        subtitle={
          total === 0
            ? "Muévelas hacia la derecha conforme avancen"
            : `${total} en total · muévelas hacia la derecha conforme avancen`
        }
        action={
          open ? null : (
            <Button variant="primary" onClick={() => setOpen(true)}>
              Nueva tarea
            </Button>
          )
        }
      />
      {open ? <NewTaskForm onDone={() => setOpen(false)} /> : null}
    </>
  );
}
