# Histórico: operación y verificación

La administración de oficina consulta las recogidas directamente desde `/admin`, con el diseño original y los avatares de alumnos. Puerta, estado y fecha comparten una única fila centrada, con líneas verticales finas entre grupos; no hay pestañas de Recogidas, Movimientos o Histórico. Hoy se refresca cada dos segundos y muestra un pequeño punto verde intermitente con “En vivo” en la esquina superior derecha de la tabla. Los rangos 7 días, 30 días y personalizado se consultan al seleccionarlos. Cada viaje cerrado conserva alumnos, persona, auto, tiempos, eventos y referencia de foto, accesibles con ⓘ. Los avisos de Retrasos se archivan por su propia jornada aunque nunca exista un viaje asociado.

## Decisiones confirmadas

- Fotos y registros: 90 días, por jornada de `America/Tijuana`. Se elimina lo anterior a hoy menos 90 días; el día límite se conserva.
- Captura general del auto: JPEG, máximo 1280 × 720, calidad 0.7, sin ampliar cámaras de menor resolución. No se garantiza lectura de placas.
- Bucket privado `arrival-photos`, rutas `YYYY-MM-DD/tripId.jpg`. Las URLs firmadas duran 60 segundos y se solicitan al abrir detalles.
- CSV: referencia estable de la foto; nunca base64 ni URL firmada. Los campos se escapan para hojas de cálculo.
- Gabriela es la cuenta demo de oficina. Maestros pueden consultar fotos de viajes vivos; solo oficina puede consultar fotos archivadas e histórico. La TV utiliza la sesión del personal del mismo navegador; sin ella muestra la referencia del vehículo.
- Modo memoria: hasta 5,000 filas archivadas; se pierden al reiniciar el proceso. En Supabase no existe ese límite de archivo.

## Preparación del despliegue

1. Programar la migración antes de habilitar tráfico con la nueva versión. Respaldar la fila `pickup_state` existente.
2. Aplicar, en orden, las cuatro migraciones de `supabase/migrations/` al proyecto correcto. No contienen datos de escuela. La primera permite iniciar una base vacía; las siguientes crean tablas privadas, bucket e interfaces SQL. La cuarta filtra estado y puerta antes de paginar.
3. Configurar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` aleatorio y estable, y `CRON_SECRET` en el entorno del servidor. Nunca exponer las claves en el cliente. Las sesiones firmadas vencen a las 12 horas.
4. Con esas variables inyectadas en el proceso, ejecutar `npm run history:backfill` antes de reanudar tráfico. El comando no carga archivos `.env` por su cuenta. Convierte primero todas las fotos anteriores y después archiva viajes cerrados y Retrasos vencidos. Si falla una foto, conserva el snapshot original; se puede repetir sin duplicar filas u objetos.
5. Habilitar la aplicación y volver a iniciar sesión con la cuenta de oficina. Verificar una llegada, entrega, salida, consulta histórica y foto.
6. Confirmar la ejecución diaria de `/api/history/maintenance`. `vercel.json` programa las 09:05 UTC; el endpoint exige `Authorization: Bearer CRON_SECRET`. Si se hospeda fuera de Vercel, programar el mismo endpoint o `npm run history:retention` diariamente.

El mantenimiento elimina objetos mediante Storage y luego filas históricas antiguas. Registra fecha límite, fotos eliminadas, fotos conservadas y bytes conservados. Un error devuelve 500 y permite reintentar. Revisar esos resultados y el uso del bucket en el proveedor. Los avisos vencidos también se archivan al consultar o modificar el estado, sin depender exclusivamente del cron.

El archivo y la actualización de `pickup_state` se confirman en una sola transacción con control de versión. Un conflicto no elimina la recogida ni duplica el archivo. Los viajes entregados permanecen vivos hasta confirmar salida o vencer el cierre automático de 30 minutos. Los viajes aún abiertos no se cancelan automáticamente por cambiar de fecha.

## Pruebas reproducibles

```sh
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:storage
npm run test:e2e
```

`test:storage` requiere Docker y crea exclusivamente el proyecto Compose `discovery-history-test`: Postgres 17, PostgREST y Supabase Storage. Usa credenciales locales de prueba, sin leer `.env.local`. Prueba llegada con foto, bucket privado, URL firmada, permisos, errores de Storage, backfill repetible, archivo diario de Retrasos, consulta pasada sin modificar el estado y retención en el límite de 90 días.

`test:e2e` requiere Microsoft Edge instalado. Inicia un servidor aislado en el puerto 3105 con Supabase desactivado explícitamente. Prueba cámara simulada 1080p reducida a 720p, visualización en personal/TV, filtros, actualización viva, ausencia de polling en otros rangos, detalles móviles y exportación CSV. No reutiliza un servidor existente. Capturas y trazas quedan en `test-results/`, ignorado por Git.

Para la prueba SQL adicional de concurrencia y rollback:

```sh
docker run -d --name discovery-history-postgres -e POSTGRES_PASSWORD=history-test postgres:17-alpine
npm run test:db
```

Al terminar, `docker compose -f tests/storage.compose.yml down --volumes` libera los contenedores y datos locales de integración. `docker rm -f -v discovery-history-postgres` elimina la base SQL adicional. Ambos contienen exclusivamente fixtures de pruebas; no ejecutar estas pruebas contra una base real.
