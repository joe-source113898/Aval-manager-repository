import { ThemeModeSelector } from "@/components/admin/config/theme-mode-selector";
import { PreferencesForm } from "@/components/admin/config/preferences-form";
import { IntegrationInfo } from "@/components/admin/config/integration-info";

export default function AdminConfiguracionPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Ajusta la apariencia del panel y gestiona opciones generales sin salir de la aplicación.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <ThemeModeSelector />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Preferencias del panel</h3>
          <p className="text-sm text-muted-foreground">
            Estos ajustes se guardan solo para la sesión actual y son útiles durante pruebas o demostraciones.
          </p>
        </div>
        <PreferencesForm />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <IntegrationInfo />
      </section>
    </div>
  );
}
