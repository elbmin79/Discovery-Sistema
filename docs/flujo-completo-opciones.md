# Flujo de salida — opciones de rediseño

> Cómo encajar el sistema de carpool en el flujo real, sin pantallas en sitio y sin
> cargar trabajo extra a los maestros.

## 1. Restricciones del cliente (lo que NO podemos cambiar)

1. **No hay pantallas / displays en sitio.** No podemos instalar un tablero, kiosco ni TV
   en la puerta. Cualquier "pantalla" debe ser un teléfono/tablet en manos del personal.
2. **Los maestros no pueden marcar alumno por alumno** como "entregado". Es demasiado
   trabajo y rompe su día.
3. **Línea de carpool continua**, nunca se detiene.
4. **Salida escalonada por grado**: kínder → primaria, ventanas de ~30 min por grupo.
5. **Posible verificación por grupo al final del turno.** El maestro del siguiente turno
   **sí puede** revisar a alumnos de turnos anteriores.
6. **Hermanos de grados distintos** pueden salir juntos en el mismo auto.

Conclusión central: el diseño actual de discovery-sistema (solicitud por alumno +
máquina de estados `arrived → preparing → ready → delivered` operada por el maestro)
**no encaja**. Hay que invertir el modelo.

---

## 2. Qué dice la investigación

### 2.1 Cómo funciona físicamente un carpool real
- Un solo punto de salida observable. Roles: monitor de entrada, director de fila,
  **spotter/llamador** (lee placas/hangtags y llama nombres por radio), "runners" que
  acercan al alumno, y cargadores que abren puertas.
- Coordinación estándar con **radios**, no con software.
- Zona de carga con **lugares numerados**; se cargan varios autos a la vez y se liberan
  en bloque para no detener la fila.

### 2.2 Cómo se verifica identidad SIN frenar la fila
- **Hangtag / placard laminado** con número grande en el retrovisor; el personal lee el
  **número, no la identidad** del conductor.
- Emparejamiento con **tag de mochila** del alumno (mismo número).
- **Placa / LPR**: identificar el auto *antes* de que llegue al frente para adelantar al
  alumno (el cuello de botella #1 citado por los vendors es "auto desconocido hasta que
  ya está en la acera").
- **Vía de escape "go-around"**: el auto sin tag sale de la fila y va a oficina con ID.
  Así la línea principal nunca se detiene por una excepción.

### 2.3 Escalonamiento y hermanos
- Escalonar es estándar (preescolar primero, luego primaria; intervalos de 5 a 30 min).
- **Regla casi universal para hermanos: todos salen en el grupo/horario del hermano
  MENOR** (el mayor baja a la zona del menor y lo espera). Con nota escrita previa.

### 2.4 Registros que las escuelas realmente llevan
- Durante la línea en movimiento, **la mayoría NO lleva registro alumno por alumno**: el
  tag/placa + el conocimiento del personal *es* el registro.
- El registro formal (log de salida temprana, log de tarde, copia de ID) solo ocurre en
  oficina / excepciones.
- Protocolo de "no recogido": supervisar en oficina → llamar contactos en orden (todo
  registrado) → 30–90 min → policía/CPS.

### 2.5 Dónde la tecnología AYUDA vs ESTORBA
- **Ayuda**: pre-notificación/LPR/RFID en la puerta; lista central de autorizados +
  banderas de custodia visibles en el punto de salida; **registro con timestamp** para
  disputas; notificación a padres ("salió a las 3:22 con X").
- **Estorba**: cualquier cosa que obligue al maestro a tocar/marcar por alumno ("los
  maestros terminan mirando pantallas"); kioscos/display en sitio; sistemas que asumen
  que cada alumno llega a la puerta "a tiempo".

### 2.6 Skolable (competidor directo) — su debilidad confirmada
- Modelo **jalado por el padre** (cada padre "solicita salida" por alumno por día) + geofence
  + escaneo QR por alumno en tablet del maestro.
- **Sin motor de horarios/ventanas**, sin agrupación de hermanos por horario, frágil ante
  GPS/notificaciones (reseñas: "el niño sale antes de que la mamá llegue al frente", "falso
  entregado", "crashes en la fila").
- Es exactamente lo que NO queremos: depende de 400 solicitudes individuales y de que cada
  maestro escanee/marque por alumno.

### 2.7 Patrón ganador en competidores (el "sweet spot")
Cluster "cero esfuerzo para maestros, sin displays": **Dismissal Manager, Placa.ai,
Safe Pick Up, SchoolPass, Carline.app, Carpool Companion**. En todos, la salida se
**centraliza en la puerta** (1–2 personas con teléfono), el maestro no toca la app, la
identificación es por placa/hangtag/QR/geofence, y el registro se genera solo.

---

## 3. El giro estratégico

| Hoy (discovery-sistema) | Debería ser |
|---|---|
| Padre solicita por alumno, cada día | **Plan por defecto** (días, quién, vehículo); la excepción es la única acción |
| Maestro opera máquina de estados | **Maestro no toca nada durante la línea** |
| Kiosco/monitor en sitio | **Teléfono en mano del personal de puerta** |
| Flujo jalado por 400 padres | **La escuela maneja el flujo por horarios/ventanas** |
| Registro manual de entrega | **Registro automático** (detección de llegada → liberación) + reconciliación al cierre |

La pregunta ya no es "¿cómo marcamos entregas?" sino **"¿quién es la única persona con un
teléfono en la puerta, y qué ve?"**

---

## 4. Opciones de flujo (menú)

### Opción A — Plan por defecto + escáner de puerta en el teléfono *(RECOMENDADA)*
La escuela maneja el flujo; el padre no necesita hacer nada salvo excepciones.

**Actores y pasos:**
1. **Setup (una vez):** la familia registra su plan por defecto (quién recoge, días,
   vehículo, personas autorizadas, banderas de custodia). Nada que hacer por día.
2. **Excepción (opcional):** si hoy cambia algo ("va la abuela", "sale a pie"), el padre
   lo marca en la app. Si no, silencio — el sistema ya sabe.
3. **Ventana de salida:** el sistema arma automáticamente la lista del grupo que toca
   (kínder → primaria, 30 min). Hermanos quedan en la ventana del **menor**; el mayor se
   pre-escenifica ahí.
4. **Puerta:** UN personal con teléfono. El auto llega → lee **hangtag/placa** (o el padre
   muestra un QR en el celular). Un escaneo identifica a toda la familia y sus alumnos.
5. **Pre-notificación:** al identificar el auto (o al detectar geofence de aproximación),
   el sistema avisa al runner/staging *antes* de que el auto llegue al frente.
6. **Liberación:** el personal de puerta llama al alumno (como ya lo hace por radio) y lo
   entrega. **Cero taps por alumno.** Un solo "familia salió" opcional, o nada: la
   liberación se infiere del escaneo de llegada.
7. **Registro:** el evento (quién, a qué hora, con quién, qué alumnos) se escribe solo en
   la bitácora.
8. **Cierre de turno (reconciliación):** la pantalla de "pendientes" muestra quién no ha
   salido de la ventana. El maestro/personal confirma en bloque ("grupo kínder cerrado,
   2 no salieron → oficina"). El maestro del **siguiente turno** ve los pendientes del
   anterior en el mismo roster compartido.

**Esfuerzo maestro:** cero durante la línea; solo la confirmación de cierre (opcional).
**Hardware:** un teléfono en la puerta. **Qué cambia en discovery-sistema:** se elimina/rebaja
la máquina de estados del maestro; el kiosco se convierte en "escaner de puerta en teléfono";
se agrega "plan por defecto" + "ventanas por grado" + "roster de pendientes por turno".

---

### Opción B — Plan por defecto + detección pasiva (sin escaneo)
Igual que A, pero la identificación es **automática**: reconocimiento de placa (LPR) o el
padre toca "llegué" (geofence/botón). Nadie escanea; nadie marca.

**Pros:** mínimo contacto humano; la fila fluye sola.
**Contras:** requiere cámara LPR (costo) o disciplina de los padres para tocar "llegué";
sin un escaneo, es más difícil saber *quién* está en el auto exacto. El registro depende
de la confirmación del padre ("recibí a Sofía") o de la salida del geofence.

---

### Opción C — Roster por ventana (casi sin software en la puerta)
El sistema solo **imprime/muestra en el teléfono del personal la lista del grupo que toca**,
con banderas (custodia, autorizados, "no ha salido"). La línea se corre como siempre
(llamar nombres por radio). El valor es: lista viva + banderas + reconciliación de cierre
+ registro.

**Pros:** la menor fricción posible; encaja en el flujo actual sin cambiarlo.
**Contras:** no hay detección de llegada automática; el registro requiere un tap de "grupo
liberado" al cierre (que el usuario ya aceptó). Menos "wow" para el demo.

---

### Opción D — Automatización por control de acceso (turnstiles/proximidad) *(DESCARTADA)*
Portikal/Insegvial: tarjeta de proximidad + torno + pantalla. **Cero humanos marcan.** Pero
requiere infraestructura de acceso (tornos, lectores) y **pantalla en la zona de fila** —
viola la restricción de "no displays" y no hay presupuesto de hardware.

---

## 5. Mecánica transversal (aplica a A, B y C)

1. **Hermanos → ventana del menor.** Regla universal; pre-escenificar al mayor ahí.
2. **Relevo de turno:** un solo roster compartido por turnos; el maestro siguiente ve los
   pendientes del anterior (esto ya lo permite el modelo de snapshot + bitácora).
3. **No recogido:** escalación automática — contacto en orden, todo logueado.
4. **Banderas de custodia / autorizados:** visibles en el punto de salida (no enterradas).
5. **Registro/auditoría:** la bitácora que ya construimos es exactamente la pieza que
   diferencia el producto; se alimenta solo.
6. **Vía de escape:** excepciones (sin tag, cambio de último minuto) van a oficina, nunca
   detienen la línea principal.

---

## 6. Recomendación y siguiente build

**Recomendación: Opción A** (plan por defecto + escáner de puerta en teléfono + reconciliación
de cierre). Es la que mejor ataca la debilidad de Skolable, respeta todas las restricciones,
y reutiliza lo que ya existe en discovery-sistema.

**Prototipo mínimo de la Opción A:**
1. **Plan por defecto por familia** (días, picker, vehículo) — hoy la app es "Voy por X"
   cada vez; cambiar a "plan" con override de excepción.
2. **Ventanas por grado** (kínder → primaria, 30 min) — agrupar el roster por ventana.
3. **Agrupación de hermanos a la ventana del menor.**
4. **Escáner de puerta en teléfono** (reusar el flujo de kiosco QR/código, sin montar nada).
5. **Roster de "pendientes" por turno + confirmación de cierre de grupo.**
6. Eliminar/ocultar la máquina de estados del maestro (ya no es el actor).

## 7. Preguntas de discovery para resolver con la escuela

- ¿Quién está hoy físicamente en la puerta (cuántos, con radio, con teléfono)?
- ¿Cómo identifican hoy al auto: conocen a la familia, hangtag, placa, nada?
- ¿El auto con hermanos sale en la ventana del menor o hay excepción?
- ¿Quién decide cuándo "cierra" un grupo y qué pasa con los que no salieron?
- ¿El padre hoy toca algo en su celular, o prefiere no tocar nada?
- ¿Quieren registro por alumno con timestamp, o basta con cierre por grupo?
- ¿Qué fue exactamente lo que no les convenció de Skolable / Vámonos!?
