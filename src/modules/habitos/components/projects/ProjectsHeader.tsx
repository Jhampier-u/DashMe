"use client";

import { useState } from "react";
import { PageHeader } from "@/modules/core/ui/PageHeader";
import { Button } from "@/modules/core/ui/Button";
import { NewProjectForm } from "./NewProjectForm";

/**
 * Cabecera y formulario. Comparten el estado de abierto: el botón va en la
 * cabecera y el formulario debajo, a todo el ancho.
 */
export function ProjectsHeader({
  total,
  terminados,
}: {
  total: number;
  terminados: number;
}) {
  const [open, setOpen] = useState(false);

  /*
    Decía «N en marcha» con el total, terminados incluidos: un proyecto con
    todas sus tareas hechas seguía contando como en marcha. Ahora en marcha
    significa en marcha, y los terminados se nombran aparte cuando los hay.
  */
  const enMarcha = total - terminados;
  const subtitulo =
    total === 0
      ? "Descompón lo grande en subtareas anidadas"
      : terminados === 0
        ? `${enMarcha} en marcha · descompón lo grande en subtareas anidadas`
        : `${enMarcha} en marcha · ${terminados} ${
            terminados === 1 ? "terminado" : "terminados"
          }`;

  return (
    <>
      <PageHeader title="Proyectos" subtitle={subtitulo}
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
