# WebTomorrowland

MVP público para explorar y comparar alternativas de viaje a Tomorrowland Brasil 2027.

La aplicación permite revisar planes para una o dos personas y comparar hasta tres alternativas. Los datos incluidos son demostrativos y todos sus precios están identificados como `ESTIMATED`.

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

Las colecciones esperadas son `plans` y `exchangeRates`. Cada plan utiliza `TravelPlan`; las tasas se identifican por pares estables como `BRL_CLP`. Las reglas incluidas permiten lectura pública y bloquean todas las escrituras del cliente. Si una tasa no está disponible, la aplicación conserva el precio original y omite la conversión sin bloquear los planes.

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
- Deploy `tomorrowland-sync-deploy`: `roles/cloudfunctions.developer` en el proyecto y `roles/iam.serviceAccountUser` sobre la identidad runtime y la cuenta de Cloud Build correspondiente. Guarda su JSON completo únicamente en el GitHub Secret `FIREBASE_SERVICE_ACCOUNT_FUNCTIONS_DEPLOY`.

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
