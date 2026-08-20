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

Vite mostrará la URL local. La aplicación usa datos demo de forma predeterminada y no requiere una cuenta Firebase.

## Validaciones

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

`npm run test:watch` mantiene Vitest activo durante el desarrollo y `npm run preview` sirve localmente el contenido ya generado en `dist/`.

## Configuración de Firebase

Firestore está preparado como fuente de producción, pero no contiene credenciales reales. Copia `.env.example` a `.env.local` y completa las variables `VITE_FIREBASE_*`. Para activar el adaptador remoto configura:

```dotenv
VITE_DATA_SOURCE=firestore
```

La colección esperada es `plans`; cada documento utiliza el modelo `TravelPlan` definido en `src/models/plan.ts`. Las reglas incluidas permiten lectura pública de esa colección y bloquean escrituras del cliente. Revisa esas reglas antes de habilitar un proyecto real.

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

El workflow `.github/workflows/ci-deploy.yml` instala con `npm ci` y ejecuta lint, tests y build en cada pull request y push a `main`. En un push a `main`, el job de deploy publica en Firebase Hosting solo si el repositorio tiene configurados estos GitHub Secrets:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

No se ha creado ningún recurso remoto ni realizado un despliegue. Para una configuración manual futura, copia `.firebaserc.example` a `.firebaserc`, reemplaza el ID de ejemplo y registra los secretos anteriores en GitHub.
