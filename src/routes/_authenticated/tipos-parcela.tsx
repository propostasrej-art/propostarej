import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ListPlus, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Btn, Field, Input, PageHeader, Pill, Td, Th } from "@/components/kit";
import { supabase } from "@/integrations/supabase/client";
import { carregar, getState, useStore } from "@/lib/store";
import { TIPOS_PARCELA } from "@/lib/rateio";
import { podeCriarTipoParcela, validarNomeTipo } from "@/lib/tipos-parcela";
import { uid } from "@/lib/format";
import { meta } from "@/lib/helpers";

export const Route = createFileRoute("/_authenticated/tipos-parcela")({
  beforeLoad: () => { if (!podeCriarTipoParcela(getState().eu?.papel)) throw redirect({ to: "/" }); },
  head: () => meta("Tipos de Parcela", "Cadastro administrativo de tipos de parcela para propostas imobiliárias."),
  component: TiposParcela,
});

function TiposParcela() {
  const tipos = useStore((s) => s.tiposParcela);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    const invalido = validarNomeTipo(nome, tipos);
    if (invalido) { setErro(invalido); return; }
    setSalvando(true); setErro(null);
    try {
      const { error } = await supabase.from("tipos_parcela").insert({ id: uid(), nome: nome.trim() });
      if (error) { setErro(error.code === "23505" ? "Este tipo de parcela já existe." : "Não foi possível salvar o tipo de parcela."); return; }
      await carregar();
      setNome(""); toast.success("Tipo de parcela cadastrado");
    } catch { setErro("Não foi possível salvar o tipo de parcela."); }
    finally { setSalvando(false); }
  }
  return <div>
    <PageHeader title="Tipos de Parcela" actions={<Pill><ShieldCheck className="mr-1 h-3 w-3" />Administrador</Pill>} />
    <form onSubmit={salvar} className="mb-8 flex flex-wrap items-end gap-3 border-b pb-6">
      <Field label="Nome do tipo de parcela" className="w-full sm:max-w-md"><Input required maxLength={80} value={nome} disabled={salvando} onChange={(e) => { setNome(e.target.value); setErro(null); }} /></Field>
      <Btn type="submit" disabled={salvando}><Save className="h-4 w-4" />{salvando ? "Salvando…" : "Cadastrar tipo"}</Btn>
      {erro && <p role="alert" className="w-full text-sm text-destructive">{erro}</p>}
    </form>
    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><ListPlus className="h-4 w-4 text-primary" />Tipos disponíveis</h2>
    <div className="overflow-x-auto"><table className="w-full"><thead><tr><Th>Tipo de parcela</Th><Th>Origem</Th></tr></thead><tbody>
      {TIPOS_PARCELA.map((tipo) => <tr key={tipo}><Td>{tipo}</Td><Td><Pill tone="muted">Padrão</Pill></Td></tr>)}
      {tipos.map((tipo) => <tr key={tipo.id}><Td className="font-medium">{tipo.nome}</Td><Td><Pill>Cadastrado</Pill></Td></tr>)}
    </tbody></table></div>
  </div>;
}