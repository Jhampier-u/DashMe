"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { NewProjectForm } from "./NewProjectForm";

/**
 * Cabecera y formulario. Comparten el estado de abierto: el botón va en la
 * cabecera y el formulario debajo, a todo el ancho.
 */
export function ProjectsHeader({ total }: { total: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Proyectos"
        subtitle={
          total === 0
            ? "Descompón lo grande en subtareas anidadas"
            : `${total} en marcha · descompón lo grande en subtareas anidadas`
        }
        action={
          open ? null : (
            <Button variant="primary" onClick={() => setOpen(true)}>
              Nuevo proyecto
            </Button>
          )
        }
      />
      {open ? <NewProjectForm onDone={() => setOpen(false)} /> : null}
    </>
  );
}
