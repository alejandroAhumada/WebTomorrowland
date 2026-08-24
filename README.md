# WebTomorrowland

MVP público para explorar y comparar alternativas de viaje a Tomorrowland Brasil 2027.

La aplicación permite revisar planes para una o dos personas y comparar hasta tres alternativas. Los datos incluidos son demostrativos y todos sus precios están identificados como `ESTIMATED`.

## Presupuesto completo del viaje

Cada plan conserva su precio Tomorrowland original y añade un presupuesto independiente en CLP para responder cuánto costaría aproximadamente el viaje completo. El cálculo centralizado combina Tomorrowland, vuelo, transporte local, alimentación y gastos personales; cards, detalle y comparador consumen el mismo modelo.

Las estimaciones iniciales viven en `src/data/travelBudgetEstimates.ts` y suponen un viaje de 5 días y 4 noches: vuelo SCL ↔ São Paulo `$400.000` por persona, alojamiento externo `$70.000` por habitación/grupo y noche, transporte local `$120.000` por grupo, alimentación `$36.000` por persona y día y gastos personales `$150.000` por persona. Son referencias configurables, versionadas y marcadas siempre como `ESTIMATED`; no provienen de Tomorrowland ni se almacenan en `plans`. Esta alternativa local mantiene el MVP simple y permite sustituir luego la configuración por un repositorio Firestore sin cambiar los componentes. El alojamiento externo solo se suma cuando las señales estructuradas del plan indican que no incluye Global Journey Hotel ni DreamVille.

El componente Tomorrowland se convierte dinámicamente a CLP mediante la tasa BCCh existente. Los gastos `PER_PERSON` se multiplican por `travelerCount`; los gastos `PER_GROUP` se agregan una sola vez. Si el precio del plan, la tasa o cualquier componente es desconocido, el desglose conserva los valores conocidos pero el total y el total por persona permanecen pendientes: nunca se suma un importe desconocido como cero.

Desde el detalle de cualquier plan, **Ajustar mi presupuesto** permite personalizar duración y todos los supuestos estimados. Las preferencias se aplican globalmente a cards, detalles y comparador, se validan antes de usarse y se guardan solo en el navegador bajo `webtomorrowland:budget-preferences:v1`. El botón **Restablecer estimaciones** elimina la personalización y recupera la fuente única de defaults. Los límites actuales son 1–30 días, 0–30 noches y valores monetarios enteros entre CLP 0 y máximos amplios definidos por categoría; los valores inválidos muestran feedback y nunca se corrigen silenciosamente.

La Home calcula recomendaciones explicables para 1 o 2 personas sin persistir rankings: menor presupuesto completo por persona, menor precio Tomorrowland original BRL por persona y menor presupuesto entre planes con alojamiento incluido. Los planes `PENDING` o sin conversión requerida quedan fuera del criterio correspondiente. Cada criterio conserva su ganador real; cuando un plan gana varios, las fortalezas se agrupan en una sola card. Los empates se resuelven por métrica, precio Tomorrowland BRL por persona, nombre e ID. Las preferencias locales recalculan estos resultados inmediatamente.

**Mi viaje** permite elegir una alternativa exclusivamente para planificación. Guarda solo el ID estable en `webtomorrowland:my-trip:v1`; nunca persiste precios, presupuestos ni snapshots del plan. En cada carga resuelve el documento actual mediante el repositorio y combina sus datos vigentes con BCCh, BudgetPreferences e Important Events. La selección se sincroniza entre pestañas, funciona en memoria si el almacenamiento está bloqueado y se descarta si el plan deja de existir. No representa una compra, reserva ni entrada confirmada.

**Mi ruta a Tomorrowland** deriva una cronología desde la aplicabilidad estructurada de cada evento: `ALL`, `PLAN_CATEGORIES` o, solo para excepciones, `PLAN_IDS`. No copia fechas al navegador ni infiere relevancia desde nombres. El Research Agent solo puede proponer `appliesTo` cuando la fuente oficial demuestra la relación, y Event Sync API valida el campo antes de escribirlo.

**Mi preparación** es una checklist personal, separada visual y semánticamente de los hitos oficiales. Sus definiciones se derivan localmente desde datos estructurados del plan; por ejemplo, alojamiento externo solo aparece cuando el paquete no lo incluye. El navegador persiste exclusivamente progreso por plan en `webtomorrowland:trip-preparation:v1`, nunca títulos, planes ni datos oficiales. No utiliza Firestore, Research Agent ni Sync APIs.

Vuelo, alojamiento externo, seguro y transporte permiten registrar opcionalmente un gasto real en CLP y una fecha civil de pago. Completar una tarea y registrar un gasto son acciones independientes. El esquema local V2 migra automáticamente el progreso V1 bajo la misma key y conserva por separado la estimación original, lo pagado y una proyección actual. Solo se reemplazan estimaciones comparables; gastos no contemplados, como el seguro, se incorporan como adicionales. Esta información nunca sale del navegador.

## Requisitos

- Node.js 22
- npm (incluido con Node.js)

## Instalación y ejecución

```bash
npm ci
npm run dev
```

Vite mostrará la URL local. El repositorio no incluye configuración privada ni archivos de entorno locales.

## Validaciones

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

`npm run test:watch` mantiene Vitest activo durante el desarrollo y `npm run preview` sirve localmente el contenido ya generado en `dist/`.

## Configuración de Firebase

Firestore es la fuente de producción del proyecto `web-pack-tomorrowland`. Copia `.env.example` a `.env` y completa la configuración pública de la Web App. Para activar el adaptador remoto configura:

```dotenv
VITE_DATA_SOURCE=firestore
```

Para trabajar con los datos demo sin consultar Firebase, usa `VITE_DATA_SOURCE=demo` en el archivo local o para un solo comando:

```bash
VITE_DATA_SOURCE=demo npm run dev
```

Las colecciones públicas esperadas son `plans`, `exchangeRates` e `importantEvents`. Cada plan utiliza `TravelPlan`; las tasas se identifican por pares estables como `BRL_CLP`. Las reglas incluidas permiten lectura pública y bloquean todas las escrituras del cliente. Si una tasa no está disponible, la aplicación conserva el precio original y omite la conversión sin bloquear los planes.

## Dataset de producción

Los planes trazables están definidos en `scripts/productionPlans.ts` y las tasas en `scripts/productionExchangeRates.ts`. El seed usa IDs estables, valida los datos antes de escribir y reemplaza idempotentemente esos documentos sin habilitar escrituras públicas. La referencia BRL→CLP usa directamente la serie diaria `F072.CLP.BRL.N.O.D` del Banco Central de Chile; la moneda original de cada plan no se modifica.

## Sincronización automática BRL → CLP

El workflow independiente `sync-bcch-exchange-rate.yml` consulta mediante SOAP la serie diaria `F072.CLP.BRL.N.O.D` de la API BDE, selecciona la última observación válida de una ventana de 14 días y sincroniza `exchangeRates/BRL_CLP`. Se ejecuta de lunes a viernes a las 21:30 UTC, aproximadamente 17:30 en invierno y 18:30 en verano en Chile. Fines de semana, feriados y retrasos no son errores si existe una observación reciente.

Configura estos GitHub Actions Secrets:

- `BCCH_API_USER`: email de una cuenta BDE con acceso API habilitado.
- `BCCH_API_PASSWORD`: contraseña de esa cuenta.
- `FIREBASE_SERVICE_ACCOUNT_FIRESTORE_SYNC`: JSON completo de una service account dedicada con `roles/datastore.user` en `web-pack-tomorrowland`.

La cuenta de Firestore no necesita permisos de Hosting ni administración IAM. Ningún Secret llega al frontend, a Firestore o a artefactos. El workflow también puede ejecutarse desde **Actions → Sync BCCh exchange rate → Run workflow**. Sus resultados posibles son `UPDATED`, `NO_CHANGE`, `CORRECTION`, `STALE_SOURCE` y `FAILED`; cada ejecución crea un documento administrativo en `syncRuns`, colección que no tiene lectura pública.

`observedAt` es la fecha publicada por BCCh. `fetchedAt` identifica cuándo se obtuvo la observación actualmente almacenada y `updatedAt` cuándo se escribió ese estado; ambos cambian solamente en `UPDATED` o `CORRECTION`. Las ejecuciones sin cambios se trazan en `syncRuns`. Verifica la última ejecución en GitHub Actions y, administrativamente, en las colecciones `syncRuns` y `exchangeRates` de Firestore.

## Novedades y fechas clave

La Home consulta `importantEvents` mediante la misma abstracción local/Firestore usada por el resto del frontend. El modelo conserva fecha u hora oficial, zona `America/Sao_Paulo`, tipo, prioridad y trazabilidad. Los estados `UPCOMING`, `TODAY` y `PAST`, el próximo hito y los días restantes se calculan en el navegador; no se persisten.

El bootstrap manual es independiente del seed de planes y no elimina documentos desconocidos:

```bash
npm run seed:events
GOOGLE_APPLICATION_CREDENTIALS=/ruta/segura/service-account.json npm run seed:events:write
```

Ambos comandos validan IDs, fechas y hostnames oficiales; el segundo usa escrituras idempotentes con IDs estables y relee cada documento. La escritura pública continúa bloqueada. El seed permanece disponible solo para bootstrap/manual; la actualización periódica utiliza la barrera privada descrita a continuación.

## Tomorrowland Important Events Sync API

`syncTomorrowlandEvent` es una Function HTTP 2nd gen privada, independiente del frontend, que acepta una propuesta `CREATE` o `UPDATE` sobre `importantEvents`. El contrato exige `proposalId`, `eventId` semántico, `observedAt`, fuente oficial, cambios permitidos y evidencia pequeña con hash. Solo admite HTTPS con hostname exacto oficial y rechaza campos desconocidos, edición incorrecta, fechas inválidas, regresiones temporales y `DELETE`.

La creación automática requiere fecha explícita, categoría importante permitida y evidencia inequívoca de Tomorrowland Brasil 2027. Una fecha u hora existente solo cambia con evidencia explícita de reprogramación; una hora no desaparece por fallo de extracción. `CANCELLED` exige texto oficial de cancelación, la ausencia en una página nunca cancela ni elimina, y un evento cancelado no se reactiva automáticamente.

El flujo obligatorio es `?dryRun=true`; solo `CREATED` o `UPDATED` puede reenviarse en modo real. La transacción real mantiene atómicamente `importantEvents/{eventId}`, `eventSyncProposals/{proposalId}`, `eventSyncState/{eventId}`, `syncRuns/tomorrowland_event_{proposalId}` y, únicamente ante cambio, `importantEvents/{eventId}/history/{proposalId}`. Un payload repetido devuelve `ALREADY_PROCESSED`; reutilizar el ID con otro payload se rechaza. Ninguna colección administrativa ni historial tiene lectura pública.

La Function reutiliza el runtime mínimo `tomorrowland-sync-api` y solo `tomorrowland-sync-client` tiene `roles/run.invoker` sobre el servicio. El workflow manual **Deploy Tomorrowland Sync API** permite elegir explícitamente qué Function desplegar y conserva el despliegue separado de Hosting y BCCh.

## Tomorrowland Plan Sync API

La barrera de escritura para la futura automatización de contenido es una función HTTP de Firebase Functions 2nd gen llamada `syncTomorrowlandPlan`, separada del frontend y del sincronizador BCCh. No busca información ni llama a IA: recibe una propuesta, valida schema y dominio, compara el plan actual y ejecuta una transacción Firestore.

El endpoint acepta exclusivamente `POST` con `Content-Type: application/json` y una propuesta individual:

```json
{
  "proposalId": "research-2026-09-03-easy-tent-001",
  "planId": "easy-tent-2p-2027",
  "observedAt": "2026-09-03T12:00:00.000Z",
  "source": {
    "url": "https://brasil.tomorrowland.com/en/tickets/",
    "type": "OFFICIAL",
    "publisher": "Tomorrowland"
  },
  "changes": {
    "price": {
      "totalPrice": { "amount": 7609, "currency": "BRL" },
      "priceType": "OFFICIAL"
    }
  }
}
```

Los únicos cambios permitidos son `price` (precio total y tipo como una unidad), `inclusions`, `notIncluded` y `status`. ID, cantidad de viajeros, categoría, alojamiento, transporte, entrada y camping permanecen inmutables. Solo se admiten URLs HTTPS de `tomorrowland.com`, `www.tomorrowland.com` y `brasil.tomorrowland.com`, comparando el hostname exacto.

La API permite `PENDING → OFFICIAL`, `ESTIMATED → OFFICIAL` y correcciones `OFFICIAL → OFFICIAL`. Rechaza degradaciones `OFFICIAL → ESTIMATED/PENDING`, propuestas antiguas, timestamps futuros, planes inexistentes, IDs reutilizados con otro payload y cualquier candidato que no supere `TravelPlan`. `observedAt` pertenece a la fuente; `receivedAt`, `completedAt` y el `updatedAt` aplicado provienen del servidor.

Usa `?dryRun=true` para ejecutar las mismas lecturas y validaciones sin escribir plan, auditoría, historial ni marcador de idempotencia. Los resultados son `UPDATED`, `NO_CHANGE`, `REJECTED` y `ALREADY_PROCESSED`. Una ejecución real crea `planSyncProposals/{proposalId}`, `syncRuns/tomorrowland_{proposalId}` y actualiza `planSyncState/{planId}` para impedir regresiones incluso después de un `NO_CHANGE`; un cambio aplicado también crea `plans/{planId}/history/{proposalId}` con solo los campos anteriores y nuevos afectados. Estas colecciones administrativas y el historial no son públicos. Un fallo interno intenta registrar `FAILED` sin exponer detalles sensibles; si Firestore también falla, el error queda en Cloud Logging.

La autenticación es IAM, no un token de aplicación. La función se ejecuta como `tomorrowland-sync-api@web-pack-tomorrowland.iam.gserviceaccount.com` y solo admite invocaciones de `tomorrowland-sync-client@web-pack-tomorrowland.iam.gserviceaccount.com`. El cliente debe enviar un ID token de Google con la URL desplegada como audiencia. No existe autenticación en el JSON de negocio.

Para preparar producción se requieren tres identidades separadas:

- Runtime `tomorrowland-sync-api`: `roles/datastore.user` en el proyecto.
- Caller `tomorrowland-sync-client`: `roles/run.invoker` únicamente sobre la función/servicio desplegado; la configuración `invoker` del código aplica esta relación.
- Deploy `tomorrowland-sync-deploy`: `roles/cloudfunctions.admin` en el proyecto —necesario para aplicar la política `invoker` privada— y `roles/iam.serviceAccountUser` sobre la identidad runtime y la cuenta de Cloud Build correspondiente. Un rol personalizado puede reemplazar al rol Admin si incluye los permisos de despliegue y `cloudfunctions.functions.setIamPolicy`. Guarda su JSON completo únicamente en el GitHub Secret `FIREBASE_SERVICE_ACCOUNT_FUNCTIONS_DEPLOY`.

El proyecto debe estar en el plan Blaze para habilitar Cloud Functions, Cloud Build y Artifact Registry. La API no puede desplegarse mientras permanezca en Spark.

El workflow manual **Deploy Tomorrowland Sync API** valida todo antes de autenticarse y despliega exclusivamente el codebase `tomorrowland-sync`. No forma parte de cada cambio visual. Para compilar localmente:

```bash
npm run build:functions
```

El emulador puede iniciarse con Firebase CLI mediante `firebase emulators:start --only functions,firestore --project demo-webtomorrowland`; necesita planes de prueba en el emulador para ejercer el endpoint. IAM se valida en producción, no en el emulador.

Valida el dataset sin acceder a Firestore:

```bash
npm run seed:firestore
```

Para escribir y verificar la colección se requieren credenciales administrativas fuera del repositorio mediante Application Default Credentials:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/ruta/segura/service-account.json npm run seed:firestore:write
```

Nunca copies la clave dentro del proyecto. El script apunta explícitamente a `web-pack-tomorrowland` y falla si la colección final contiene IDs distintos del dataset esperado.

## Tomorrowland Official Research Agent

El investigador específico de Tomorrowland Brasil 2027 se ejecuta en GitHub Actions, separado del frontend, del sincronizador BCCh y de Firebase Admin. Cada ocho horas (`17 */8 * * *`, UTC) procesa planes y acontecimientos. Descarga únicamente fuentes oficiales configuradas en `scripts/tomorrowlandResearch.ts` y `scripts/tomorrowlandEventResearch.ts`, extrae evidencia pequeña, genera IDs deterministas y envía propuestas a la Sync API correspondiente. No tiene acceso directo a Firestore; no crea ni elimina planes y nunca elimina acontecimientos.

La primera versión es determinista y no utiliza OpenAI. Los precios solo se extraen cuando un encabezado de producto exacto tiene un único importe BRL asociado en el HTML semántico. Se monitorizan directamente `Full Madness Pass` 1P, `Vida Nova 2P`, `Easy Tent 2P` y `Spectacular Easy Tent 2P`. `full-madness-2p-2027` conserva `ESTIMATED`: nunca se convierte en oficial por multiplicar el ticket unitario. Los Global Journey permanecen sin propuesta hasta que la fuente publique un precio inequívoco asociado explícitamente a ocupación 1P o 2P.

El catálogo distingue productos oficiales, escenarios derivados y configuraciones con información oficial pendiente. `full-madness-2p-2027` se presenta como **2 × Full Madness Pass**: es un escenario de planificación calculado desde dos entradas individuales oficiales, no un pack 2P de Tomorrowland. Las modalidades Regular, Comfort y N°1 solo aparecen cuando una relación producto–modalidad está publicada explícitamente. En “Mi viaje”, la modalidad considerada se guarda localmente por `planId`; al cambiarla, el presupuesto usa el precio oficial del offering o, únicamente para el escenario 2 × Full Madness, el cálculo derivado explícito. Esta elección no representa compra, reserva ni disponibilidad.

El fetch exige HTTPS y hostname exacto `tomorrowland.com`, `www.tomorrowland.com` o `brasil.tomorrowland.com`; limita redirects, tiempo, tamaño y `Content-Type`. Un 404, timeout, captcha, HTML inválido, precio ausente o ambiguo falla visiblemente y nunca produce una escritura. No se guardan páginas completas: la evidencia se limita a producto y precio. El hash usa contenido relevante normalizado y se conserva en cache de Actions; es una optimización, no una barrera de consistencia.

```text
fuente oficial -> evidencia -> propuesta -> Sync API dry-run
                                      CREATED/UPDATED -> misma propuesta real
                                      NO_CHANGE/REJECTED/error -> no escribir
```

La ejecución manual está en **Actions → Research Tomorrowland official sources → Run workflow**. `Research scope` permite elegir `all`, `plans`, `events` o `information`. Mantén `Apply changes` desactivado para investigación segura; activarlo no omite el dry-run, solo permite reenviar propuestas aceptadas. El cron usa `all` y el flujo completo. Los logs muestran fuente, hash abreviado, entidad, `proposalId` y resultados, pero nunca tokens, headers, HTML ni credenciales.

### Ticket tiers e información oficial

`ticketTiers` modela Regular, Comfort y N°1 sin duplicar planes: cada documento contiene beneficios/condiciones generales y una lista explícita de ofertas por `planId`, con su precio BRL oficial o estado pendiente y URL de producto. Nunca se deriva un precio de otro tier ni se extrapola disponibilidad. `importantInformation` conserva condiciones oficiales relevantes que no son planes ni hitos; Treasure Case referencia el acontecimiento accionable `treasure-case-home-delivery-deadline-2027` para que la fecha tenga una sola fuente temporal.

El frontend puede leer ambas colecciones; clientes no pueden escribirlas ni consultar propuestas, estado, historial o `syncRuns`. `syncTomorrowlandContent` es una Function 2nd gen privada, ejecutada con la misma identidad runtime administrativa mínima y solo invocable por `tomorrowland-sync-client`. Valida el documento completo según su dominio, URL oficial, evidencia acotada, observación, regresiones, idempotencia y luego ejecuta una transacción con documento, propuesta, estado, auditoría e historial. No admite DELETE.

El scope `information` del investigador reutiliza el fetch seguro, allowlist, WIF, evidencia y cron actuales. Verifica de forma determinista las páginas Festival Tickets, Easy Tent, Spectacular Easy Tent, Vida Nova y Global Journey. Si falta un precio, beneficio o condición inequívoca, no genera propuestas. Todo candidato pasa primero por `syncTomorrowlandContent?dryRun=true`; solo `CREATED` o `UPDATED` puede reenviarse sin dry-run. `NO_CHANGE`, `REJECTED` y errores no escriben.

El seed inicial es validado, idempotente y nunca elimina documentos desconocidos:

```bash
npm run seed:official-content
GOOGLE_APPLICATION_CREDENTIALS=/ruta/segura/service-account.json npm run seed:official-content:write
```

Para ampliar una modalidad o información: agrega primero el tipo/categoría al modelo, una fuente concreta allowlisted, validación y fixtures deterministas; luego añade el documento seed/extractor. La evidencia ambigua debe producir ausencia de propuesta, no una interpretación aproximada.

La extracción de acontecimientos es determinista y se centra en fechas de ventas y el festival. Reconoce pre-registro, simuladores, ventas, preventas y festival; un hito nuevo solo se crea si tiene nombre, fecha BRT inequívoca y categoría accionable. Cambios editoriales menores y desapariciones se ignoran. Para agregar una categoría o fuente, amplía primero la allowlist/modelo, añade un extractor acotado y fixtures de éxito, ambigüedad, otra edición y ausencia; no conviertas el módulo en un crawler general.

GitHub se autentica sin claves mediante OIDC y Workload Identity Federation, impersonando `tomorrowland-sync-client@web-pack-tomorrowland.iam.gserviceaccount.com`. Configura la variable `GCP_TOMORROWLAND_RESEARCH_WIF_PROVIDER` con el nombre completo del provider, por ejemplo `projects/672021161403/locations/global/workloadIdentityPools/POOL/providers/PROVIDER`. El provider debe restringir `repository == 'alejandroAhumada/WebTomorrowland'`, y solo ese principal debe tener `roles/iam.workloadIdentityUser` sobre la cuenta caller. No se requiere `OPENAI_API_KEY`, service-account JSON ni permiso Firestore.

Para agregar una fuente, incorpora una entrada con URL oficial, planes existentes y título de producto inequívoco; añade fixtures para precio válido, ausencia y ambigüedad. No agregues un plan nuevo ni una inferencia de ocupación dentro del investigador: primero amplía y revisa explícitamente el dominio y la Sync API.

## Estructura

```text
src/
├── components/  Componentes reutilizables
├── data/        Repositorios demo y Firestore
├── hooks/       Carga de datos independiente del origen
├── models/      Dominio y validaciones
├── pages/       Home, planes y comparación
├── state/       Selección para comparar
└── utils/       Formato y etiquetas
functions/
└── src/         Sync API, reglas de propuestas y adaptador administrativo Firestore
scripts/
├── tomorrowlandResearch.ts       Fetch compartido e investigación de planes
└── tomorrowlandEventResearch.ts  Eventos, evidencia y cliente Event Sync API
```

`firebase.json` configura Firebase Hosting como SPA y `firestore.rules` mantiene el acceso público en modo lectura. Los datos demo están en `src/data/demoPlans.ts`.

## CI y despliegue posterior

El workflow `.github/workflows/ci-deploy.yml` instala con `npm ci` y ejecuta lint, tests, typecheck y build en cada pull request y push a `main`. En un push a `main`, el mismo job publica exclusivamente Firebase Hosting después de aprobar todas las validaciones. Las reglas Firestore permanecen versionadas y su despliegue es manual.

Configura estas GitHub Actions Variables, todas correspondientes a la configuración pública de la Web App:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

El único GitHub Actions Secret requerido es `FIREBASE_SERVICE_ACCOUNT_WEB_PACK_TOMORROWLAND`, cuyo valor debe ser el JSON completo de una service account autorizada para desplegar Firebase Hosting. Nunca guardes ese JSON en el repositorio.

Para usar Firebase CLI localmente, copia `.firebaserc.example` a `.firebaserc` y configura `web-pack-tomorrowland` como proyecto predeterminado. El archivo real permanece ignorado por Git. La configuración pública del SDK Web no debe confundirse con una service account ni con credenciales privadas.
