import { Card } from "@/modules/core/ui/Card";
import { TABLAS_EXPORTADAS } from "@/modules/habitos";

/*
  La puerta de salida.

  Va como enlace y no como botón con JavaScript: así se puede abrir en otra
  pestaña, copiar la dirección o pedirla con `curl`, y sigue funcionando si el
  script de la página falla. Una salida que depende de que todo lo demás vaya
  bien no es una salida.

  `download` propone el nombre; la ruta ya manda el suyo en la cabecera.
*/
export function ExportarPanel({ recuento }: { recuento: number }) {
  return (
    <Card title="Llevarte tus datos">
      <p style={{ fontSize: 13 }}>
        Un fichero JSON con <b>todo lo que hay guardado</b>: hábitos, registros,
        notas, pausas, medidas de automaticidad, XP, decoraciones, misiones,
        proyectos, tareas y adjuntos. {TABLAS_EXPORTADAS.length} tablas,{" "}
        {recuento} filas ahora mismo.
      </p>

      {/*
        Decir qué NO lleva es la parte honesta. Un export que promete «todos tus
        datos» y calla que lo derivado no está es la clase de promesa que hace
        que nadie se fíe de ninguna.
      */}
      <p style={{ fontSize: 12.5, marginTop: 8 }}>
        No lleva nada <b>derivado</b> —rachas, nivel, sugerencias—, y es a
        propósito: eso se recalcula al leer, así que exportarlo sería exportar
        una opinión de hoy con aspecto de dato. Lo que se guarda es lo que sale.
      </p>

      <p style={{ fontSize: 12.5, marginTop: 8 }}>
        Nada se promedia ni se recorta con el tiempo, así que el volcado de hoy
        incluye tu primer día. El formato está descrito en{" "}
        <code>docs/formato-export.md</code> y se puede volver a importar.
      </p>

      <p style={{ marginTop: 12 }}>
        <a
          href="/api/exportar"
          download
          className={
            "inline-block px-3 py-1.5 rounded-control border-3 border-line " +
            "bg-pink text-tinta no-underline font-cuerpo text-[13px] shadow-hard " +
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line"
          }
        >
          Descargar todo
        </a>
      </p>
    </Card>
  );
}
