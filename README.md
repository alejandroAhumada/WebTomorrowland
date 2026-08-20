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

La colección esperada es `plans`; cada documento utiliza el modelo `TravelPlan` definido en `src/models/plan.ts`. Las reglas incluidas permiten lectura pública de esa colección y bloquean todas las escrituras del cliente. Una colección vacía muestra un estado informativo y nunca provoca que los datos demo se publiquen automáticamente.

## Dataset de producción

Los planes trazables están definidos en `scripts/productionPlans.ts`. El seed usa IDs estables, valida todo el dataset antes de escribir y reemplaza idempotentemente esos documentos sin habilitar escrituras públicas.

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
