import { VetosAvalesManager } from "@/components/admin/vetos/vetos-avales-manager";
import { ClientesVetadosManager } from "@/components/admin/morosidad/clientes-vetados-manager";

export default function ListaNegraPage() {
  return (
    <div className="space-y-10">
      <VetosAvalesManager />
      <ClientesVetadosManager />
    </div>
  );
}
