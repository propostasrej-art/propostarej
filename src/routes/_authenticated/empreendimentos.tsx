import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Btn, Card, Field, Input, Mono, PageHeader } from "@/components/kit";
import { setState, useStore, type Empreendimento } from "@/lib/store";
import { PROTEGIDAS, RETENCAO_PADRAO } from "@/lib/rateio";
import { nomesTiposParcela } from "@/lib/tipos-parcela";
import { pct, uid } from "@/lib/format";
import { meta } from "@/lib/helpers";

export const Route = createFileRoute("/_authenticated/empreendimentos")({
  head: () => meta("Empreendimentos", "Cadastro de empreendimentos, honorários e regras de retenção."),
  component: Emps,
});

function Emps() {
  const list = useStore((s) => s.empreendimentos);
  const cadastrados = useStore((s) => s.tiposParcela);
  const tipos = nomesTiposParcela(cadastrados);
  const [edit, setEdit] = useState<Empreendimento | null>(null);
  const save = () => { if (!edit) return; setState((s) => ({ ...s, empreendimentos: s.empreendimentos.some((e) => e.id === edit.id) ? s.empreendimentos.map((e) => (e.id === edit.id ? edit : e)) : [...s.empreendimentos, edit] })); setEdit(null); };
  return (
    <div>
      <PageHeader title="Gestão de Empreendimentos" actions={<Btn onClick={() => setEdit({ id: uid(), nome: "", endereco: "", construtora: "", honorariosPct: 5, retencao: { ...RETENCAO_PADRAO } })}><Plus className="h-4 w-4" />Novo</Btn>} />
      {edit && (
        <Card title="Dados do empreendimento" className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
            <Field label="Construtora responsável"><Input value={edit.construtora} onChange={(e) => setEdit({ ...edit, construtora: e.target.value })} /></Field>
            <Field label="Endereço completo"><Input value={edit.endereco} onChange={(e) => setEdit({ ...edit, endereco: e.target.value })} /></Field>
            <Field label="% padrão de honorários"><Input type="number" step="0.1" className="font-mono" value={edit.honorariosPct} onChange={(e) => setEdit({ ...edit, honorariosPct: +e.target.value })} /></Field>
          </div>
          <div className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Retenção de comissão por tipo de parcela (%)</div>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">{tipos.map((t) => (
            <Field key={t} label={t}><Input type="number" className="font-mono" disabled={PROTEGIDAS.includes(t)} value={PROTEGIDAS.includes(t) ? 0 : edit.retencao[t] ?? 0} onChange={(e) => setEdit({ ...edit, retencao: { ...edit.retencao, [t]: +e.target.value } })} /></Field>))}</div>
          <div className="mt-4 flex gap-2"><Btn onClick={save}>Salvar</Btn><Btn variant="outline" onClick={() => setEdit(null)}>Cancelar</Btn></div>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">{list.map((e) => (
        <Card key={e.id}>
          <div className="flex items-start justify-between"><div><h3 className="font-bold">{e.nome}</h3><p className="text-sm text-muted-foreground">{e.endereco}</p><p className="text-sm">{e.construtora}</p></div>
            <Mono className="rounded-md bg-success/10 px-2 py-1 text-sm font-semibold text-success">{pct(e.honorariosPct)}</Mono></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{tipos.map((t) => <span key={t} className="rounded-md border px-2 py-0.5 text-xs">{t}: <Mono>{pct(e.retencao[t])}</Mono></span>)}</div>
          <div className="mt-3 flex gap-2"><Btn variant="outline" onClick={() => setEdit(structuredClone(e))}>Editar</Btn>
            <Btn variant="danger" onClick={() => setState((s) => ({ ...s, empreendimentos: s.empreendimentos.filter((x) => x.id !== e.id) }))}><Trash2 className="h-4 w-4" /></Btn></div>
        </Card>))}</div>
    </div>
  );
}
