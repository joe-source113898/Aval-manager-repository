# Aval-manager

Aval-manager es una solución full-stack para administrar un servicio de avales inmobiliarios. El proyecto se divide en dos aplicaciones dentro del monorepo:

- **apps/web** – Frontend en Next.js 14 (App Router) con Tailwind CSS, shadcn/ui, React Hook Form + Zod, TanStack Table y FullCalendar.
- **apps/api** – API en FastAPI que expone el backend de negocio y se comunica con Supabase (Postgres, Storage y Auth).

## Características principales

- Panel administrativo con autenticación Supabase y navegación responsiva.
- CRUD de avales (con vista previa de documentos almacenados en Supabase Storage).
- Calendario público de firmas usando FullCalendar, compatible con modo oscuro.
- Portal público de documentos que expone únicamente los archivos del aval “en turno”.
- API FastAPI con endpoints públicos (`/public/*`) y privados protegidos por JWT.

## Requisitos

- Node.js 18+ y pnpm (`corepack enable pnpm`).
- Python 3.11+ y `pip`.
- Cuenta de Supabase para crear el proyecto, el esquema SQL y el bucket de Storage.

## Estructura

```
.
├── apps
│   ├── api      # FastAPI
│   └── web      # Next.js
├── infra
│   ├── supabase.sql                # Tablas, índices y políticas RLS
│   └── supabase-storage.buckets.json
├── .env.example                    # Plantilla con variables compartidas
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Variables de entorno

Configura los siguientes valores:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
API_BASE_URL=http://localhost:8000
```

- Copia `.env.example` a `apps/web/.env.local` y rellena las variables públicas.
- Copia `.env.example` a `apps/api/.env` para la API (incluye claves privadas).
- Estos valores ahora solo viven en tus archivos `.env*`. Ya no existen en el panel de administración, así que consúltalos directamente en el dashboard de Supabase (URL, anon key, service role, etc.) y crea tus propios archivos locales.
- Asegúrate de que los `.env*` sigan fuera del control de versiones (están ignorados en `.gitignore`) y nunca copies sus contenidos a la interfaz.

## Instalación

```bash
# Instalar dependencias de Node
pnpm install

# Crear y activar entorno Python
cd apps/api
python -m venv .venv
source .venv/bin/activate  # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Desarrollo local

En una terminal lanza la API:

```bash
cd apps/api
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

En otra terminal lanza el frontend junto con el watcher de Supabase:

```bash
pnpm dev
```

El comando anterior ejecuta `pnpm dev:web` (Next.js) y, en paralelo, un proceso que monitorea los archivos `.sql` dentro de `supabase/migrations` e `infra/`. Cada vez que detecta un cambio corre automáticamente `supabase db push --yes`, por lo que tu esquema remoto queda sincronizado sin pasos manuales. Si solo necesitas el frontend sin el watcher, usa `pnpm dev:web`.

Accede a `http://localhost:3000` para la vista pública y a `http://localhost:3000/login` para el panel administrativo.

### Documentos públicos y administración

- La página `/documentos` utiliza la función `fn_aval_en_turno` de Supabase para mostrar únicamente la documentación del aval activo.
- Desde el panel administrativo (`/admin/avales`) selecciona un aval para abrir el visualizador responsivo de documentos. Las vistas previa admiten imágenes y PDF; otros formatos se pueden descargar directamente.
- Asegura que el bucket `documentos-aval` sea público de solo lectura y que los archivos residan en rutas tipo `contratos/{contrato_id}/archivo.pdf`.

## Supabase

1. Ejecuta `infra/supabase.sql` en el editor SQL de tu proyecto Supabase.
2. Crea el bucket privado `documentos-aval` y aplica las políticas incluidas en `supabase-storage.buckets.json`.
3. Configura las variables de entorno con los valores de tu proyecto.

### Sincronización automática vía Supabase CLI

- `pnpm supabase:watch` – Observa los archivos SQL y lanza `supabase db push --yes` al detectar cambios.
- `pnpm supabase:push` – Ejecuta un push manual (sin confirmación interactiva).

El watcher realiza un `supabase db push` inicial al arrancar para asegurarse de que la base esté actualizada. Si quieres omitir ese primer push (por ejemplo, cuando ya corriste uno manual), exporta `SKIP_INITIAL_SUPABASE_PUSH=1` antes de lanzar `pnpm dev` o `pnpm supabase:watch`.

## Scripts útiles

- `pnpm --filter web build` – Compila el frontend.
- `pnpm --filter web lint` – Ejecuta el linting.
- `pnpm --filter web dev` – Desarrollo Next.js.
- `pnpm --filter web test:e2e` – Ejecuta las pruebas end-to-end (Playwright).
- `uvicorn main:app --reload` – Desarrollo FastAPI.
- `pytest` – Tests de la API (placeholder).

## Pruebas end-to-end

Las pruebas de Playwright viven en `apps/web/tests/e2e` y validan la navegación pública y el guardado del panel. Para ejecutarlas:

1. Instala los navegadores la primera vez:

   ```bash
   pnpm --filter web exec playwright install --with-deps
   ```

2. Levanta la API y el frontend en terminales separadas:

   ```bash
   # API
   cd apps/api
   source .venv/bin/activate
   uvicorn apps.api.main:app --reload

   # Frontend
   pnpm --filter web dev
   ```

3. Corre las pruebas:

   ```bash
   pnpm --filter web test:e2e
   ```

Si la app corre en otra URL, define `E2E_BASE_URL` (por ejemplo `E2E_BASE_URL=http://127.0.0.1:3000 pnpm --filter web test:e2e`). Las pruebas usan los datos reales de la instancia configurada, por lo que se requiere una base de datos/API accesible.

## PWA (iOS y Android)

El frontend ya incluye todo lo necesario para instalarse como app:

- `apps/web/public/manifest.json` define nombre, íconos, colores y accesos directos. Ajusta ahí la marca o los atajos.
- `apps/web/public/sw.js` y `apps/web/public/offline.html` implementan el service worker con caché offline y una pantalla de respaldo.
- Los íconos viven en `apps/web/public/icons/`. Reemplázalos por versiones personalizadas (192 px, 512 px y uno maskable) si cambias la identidad visual.
- `apps/web/providers/pwa-provider.tsx` registra el service worker y expone eventos `pwa:*` para mostrar banners de “Agregar a inicio”.
- El layout principal (`apps/web/app/layout.tsx`) ya declara el manifest, meta tags para Apple y el provider PWA.
- Para instalarla en Android abre la app en Chrome, espera el banner “Instalar app” o usa el menú ⋮ → “Agregar a pantalla de inicio”. En iOS abre Safari → “Compartir” → “Agregar a pantalla de inicio”.

Para probarlo en local: `pnpm --filter web dev`, abre Chrome y ejecuta la auditoría “Progressive Web App” de Lighthouse. Si usas iOS, expón tu entorno con HTTPS (o la versión desplegada) y agrega la app desde Safari para validar el modo standalone.

## Licencia

Aval-manager se distribuye bajo la licencia MIT. Puedes revisar los términos completos en el archivo `LICENSE` o en
<https://opensource.org/licenses/MIT>. Al contribuir aceptas que tu aportación se incluya bajo la misma licencia.
