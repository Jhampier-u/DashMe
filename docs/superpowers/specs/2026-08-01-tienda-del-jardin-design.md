# La tienda del jardín

Fecha: 2026-08-01 · Bloque E del rediseño del jardín · Rama `pixel`

## 1. Objetivo

Que el XP sirva para algo además de subir un número: gastarlo en decoraciones
que se quedan puestas en la escena.

## 2. El problema que hay que resolver primero

Hoy el nivel sale de `player.xp` directamente, en seis sitios. Si comprar
restara de ahí, **gastar te bajaría de nivel**, y una tienda que te degrada por
usarla no es una recompensa: es una multa.

**Regla:** el nivel sale del XP **ganado**, que no baja nunca. Lo que se gasta
sale del **saldo**.

```
ganado = saldo + gastado      (solo sube)
saldo  = lo que puedes gastar (sube y baja)
nivel  = curva(ganado)
```

Se guarda `player.xp_spent`. La alternativa —sumar el precio de lo comprado cada
vez que hace falta el nivel— obligaría a consultar las decoraciones en sitios
que no tienen nada que ver con el jardín.

Para que no se pueda olvidar, `getLevelInfo` deja de aceptar un número suelto y
pasa a recibir `{ xp, xpSpent }`. Así el compilador obliga a los seis sitios a
decidir, en vez de dejar que uno se quede con el saldo por descuido.

## 3. Qué se compra

Ocho decoraciones, cada una única: o la tienes o no. Nada de comprar tres bancos.

| Decoración | Precio | Dónde va |
|---|---|---|
| Piedra | 50 | suelo, izquierda |
| Valla | 120 | suelo, borde inferior |
| Farol | 200 | suelo, derecha |
| Banco | 260 | suelo, centro-derecha |
| Estanque | 350 | suelo, centro-izquierda |
| Espantapájaros | 450 | suelo, izquierda al fondo |
| Gato | 600 | suelo, sobre el banco |
| Arcoíris | 900 | cielo |

Cada una declara **dónde vive**. No hay un segundo sistema de colocación: las
plantas tienen huecos porque son muchas y cambian; las decoraciones son ocho,
únicas y fijas, y darles arrastre sería inventar un problema para resolverlo.

Precios en progresión para que la primera llegue pronto —50 es dos días de
hábitos— y la última cueste de verdad.

## 4. Comprar

Una acción, `comprarDecoracion(kind)`, que en una sola transacción comprueba el
saldo, resta, suma a `xp_spent` e inserta la fila. Si el saldo no llega, no
compra y **dice cuánto falta**, en texto y con el número.

No hay vender ni devolver. Añadirlo obligaría a decidir si se devuelve el precio
entero —y entonces el saldo es reversible y las decoraciones son un préstamo— o
una parte, que es una regla arbitraria más que explicar. Si algún día molesta,
se añade; hoy no molesta.

## 5. Dónde se ve

- **En la escena:** cada decoración comprada se dibuja en su sitio, detrás de las
  plantas. El pixel art es el de siempre: rejillas de texto por `Sprite`.
- **Debajo:** una tarjeta «Tienda» con las ocho, su precio, y el botón. Lo ya
  comprado se marca como tuyo y no se puede volver a comprar.

## 6. Que se entienda sin ver bien

- Lo que no puedes permitirte **lo dice con palabras** —«te faltan 130 XP»—, no
  solo con un botón apagado.
- Lo que ya es tuyo lo dice con texto, no solo con un tono distinto.
- Los precios en VT323 tabular, como el resto de los datos del jardín.
- Las decoraciones de la escena son decorativas: `aria-hidden`, y su nombre vive
  en la tienda, que es donde se interactúa con ellas.

## 7. Alcance

**Dentro:** la columna `xp_spent` con su migración, la tabla de decoraciones, el
catálogo, la compra, los ocho sprites, la tienda y el dibujo en la escena.

**Fuera:** vender, decoraciones repetidas, colocarlas a mano, y que una
decoración haga algo además de estar ahí.

## 8. Criterios de aceptación

1. Comprar **no baja el nivel**.
2. Comprar resta del saldo exactamente el precio.
3. Sin saldo no se compra, y se dice cuánto falta.
4. Lo comprado no se puede comprar dos veces.
5. Lo comprado se dibuja en la escena y sigue ahí al recargar.
6. La tienda se maneja con el teclado.
7. Un jardín sin nada comprado se ve exactamente igual que antes.
