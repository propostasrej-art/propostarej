import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Field, Input } from "@/components/kit";
import { meta } from "@/lib/helpers";

export const Route = createFileRoute("/reset-password")({
  head: () => meta("Nova senha", "Defina uma nova senha de acesso."),
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada");
    nav({ to: "/", replace: true });
  }
  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-bold">Criar nova senha</h1>
        <Field label="Nova senha"><Input type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
        <Btn type="submit" className="w-full justify-center" disabled={busy}>Salvar senha</Btn>
      </form>
    </div>
  );
}
