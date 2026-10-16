import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Field, Input } from "@/components/kit";
import { meta } from "@/lib/helpers";

export const Route = createFileRoute("/auth")({
  head: () => meta("Entrar", "Acesso restrito à equipe R&J."),
  component: Auth,
});

type Modo = "entrar" | "criar" | "esqueci";

function Auth() {
  const nav = useNavigate();
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setAviso("");
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        nav({ to: "/", replace: true });
      } else if (modo === "criar") {
        const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin, data: { nome } } });
        if (error) throw new Error(/convidado|Database error/i.test(error.message) ? "Este e-mail não foi convidado. Peça acesso a um administrador." : error.message);
        if (data.session) nav({ to: "/", replace: true });
        else setAviso("Conta criada! Confirme pelo link enviado ao seu e-mail para entrar.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setAviso("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      toast.error(/Invalid login/i.test(m) ? "E-mail ou senha incorretos." : /not confirmed/i.test(m) ? "Confirme seu e-mail antes de entrar." : m);
    } finally { setBusy(false); }
  }

  const titulo = { entrar: "Entrar", criar: "Criar conta (convidados)", esqueci: "Recuperar senha" }[modo];
  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground">R&J</div>
          <div><div className="font-bold">Analista de Cadastro</div><div className="text-sm text-muted-foreground">{titulo}</div></div>
        </div>
        <div className="space-y-4">
          {modo === "criar" && <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>}
          <Field label="E-mail"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {modo !== "esqueci" && <Field label="Senha"><Input type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>}
          {aviso && <p className="rounded-md bg-muted p-3 text-sm">{aviso}</p>}
          <Btn type="submit" className="w-full justify-center" disabled={busy}>{busy ? "Aguarde..." : titulo}</Btn>
        </div>
        <div className="mt-4 flex flex-col gap-1 text-center text-sm">
          {modo !== "entrar" && <button type="button" className="text-primary hover:underline" onClick={() => setModo("entrar")}>Já tenho conta</button>}
          {modo === "entrar" && <>
            <button type="button" className="text-primary hover:underline" onClick={() => setModo("esqueci")}>Esqueci minha senha</button>
            <button type="button" className="text-muted-foreground hover:underline" onClick={() => setModo("criar")}>Recebi um convite — criar conta</button>
          </>}
        </div>
      </form>
    </div>
  );
}
