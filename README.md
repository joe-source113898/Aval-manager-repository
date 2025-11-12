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
- `uvicorn main:app --reload` – Desarrollo FastAPI.
- `pytest` – Tests de la API (placeholder).

## Licencia

MIT
>>>>>>> 8f38aa7 (First commit)
