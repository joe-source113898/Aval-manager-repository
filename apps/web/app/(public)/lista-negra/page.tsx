import { Metadata } from "next";

import { ListaNegraPublicaClient } from "@/components/public/lista-negra-client";

export const metadata: Metadata = {
  title: "Lista negra pública | Aval-manager",
  description: "Consulta pública de vetos de avales y clientes con restricciones o adeudos.",
};

export default function ListaNegraPublicaPage() {
  return <ListaNegraPublicaClient />;
}
