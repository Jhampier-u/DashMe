"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { NewHabitForm } from "./NewHabitForm";

export function HabitsHeader({ total }: { total: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Hábitos"
        subtitle={
          total === 0
            ? "Lo que repites es lo que construyes"
            : `${total} en marcha · lo que repites es lo que construyes`
        }
        action={
          open ? null : (
            <Button variant="primary" onClick={() => setOpen(true)}>
              Nuevo hábito
            </Button>
          )
        }
      />
      {open ? <NewHabitForm onDone={() => setOpen(false)} /> : null}
    </>
  );
}
