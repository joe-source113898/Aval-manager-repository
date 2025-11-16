"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { z } from "zod";
import { toast } from "sonner";

import { FormField, FormGrid } from "@/components/forms/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useZodForm } from "@/hooks/use-zod-form";

const registerAdvisorSchema = z.object({
  nombre: z.string().min(3, "Nombre requerido"),
  telefono: z
    .string()
    .trim()
    .min(7, "Teléfono inválido")
    .regex(/^[0-9+()\s-]+$/, { message: "Formato inválido" }),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export function RegisterAdvisorForm() {
  const router = useRouter();
  const { supabaseClient } = useSessionContext();
  const [loading, setLoading] = useState(false);

  const form = useZodForm(registerAdvisorSchema, {
    defaultValues: {
      nombre: "",
      telefono: "",
      email: "",
      password: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    const { error } = await supabaseClient.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          role: "asesor",
          nombre: values.nombre,
          telefono: values.telefono,
        },
      },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Registro recibido. Revisa tu correo para confirmar la cuenta.");
    router.replace("/login?view=asesor");
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FormField control={form.control} name="nombre" label="Nombre completo">
        {(field) => <Input placeholder="Nombre y apellidos" {...field} />}
      </FormField>
      <FormGrid>
        <FormField control={form.control} name="telefono" label="Teléfono">
          {(field) => <Input type="tel" placeholder="33..." {...field} />}
        </FormField>
        <FormField control={form.control} name="email" label="Correo">
          {(field) => <Input type="email" autoComplete="email" placeholder="asesor@dominio.com" {...field} />}
        </FormField>
      </FormGrid>
      <FormField control={form.control} name="password" label="Contraseña">
        {(field) => <Input type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" {...field} />}
      </FormField>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Registrando..." : "Crear cuenta de asesor"}
      </Button>
    </form>
  );
}
