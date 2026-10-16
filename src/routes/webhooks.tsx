import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Field, Input, Mono, PageHeader, Select, Td, Th } from "@/components/kit";
import { setState, useStore, type Usuario } from "@/lib/store";
import { uid } from "@/lib/format";
import { meta } from "@/lib/helpers";

export const Route = createFileRoute("/webhooks")({
  head: () => meta("Webhooks e Acesso", "Endpoint para CRMs externos e controle de usuários."),
  component: Hooks,
});

const exemplo = JSON.stringify({ origem: "CRM", unidade: "901", torre: "A", vgv: 690000, comprador: { nome: "Lucas Pereira", cpf: "789.456.123-00" } }, null, 2);

function Hooks() {
  const s = useStore((x) => x);
  const [origin, setOrigin] = useState("");
  const [payload, setPayload] = useState(exemplo);
  const [u, setU] = useState<Usuario>({ id: "", nome: "", email: "", papel: "Corretor" });
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/api/public/propostas`;
  function simular() {
    try {
      const j = JSON.parse(payload);
      setState((x) => ({
        ...x, webhookLog: [{ at: new Date().toISOString(), origem: j.origem ?? "CRM", payload }, ...x.webhookLog].slice(0, 20),
        propostas: [...x.propostas, { id: uid(), status: "Em Análise", empreendimentoId: x.empreendimentos[0]?.id ?? "", unidade: String(j.unidade ?? ""), torre: String(j.torre ?? ""), vaga: "", vgv: +j.vgv || 0,
          compradores: [{ nome: j.comprador?.nome ?? "", cpf: j.comprador?.cpf ?? "", rg: "", endereco: "", conjuge: "" }], parcelas: [], participantes: [], createdAt: new Date().toISOString().slice(0, 10) }],
      }));
      toast.success("Proposta recebida e enviada à Inbox");
    } catch { toast.error("JSON inválido"); }
  }
  return (
    <div>
      <PageHeader title="Webhooks e Controle de Acesso" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Endpoint de entrada (CRMs externos)">
          <div className="flex gap-2"><Input readOnly value={url} className="font-mono" /><Btn variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copiado"); }}><Copy className="h-4 w-4" /></Btn></div>
          <div className="mt-3 text-sm">Método <Mono>POST</Mono> · Header <Mono>X-Webhook-Secret: {s.config.webhookSecret}</Mono></div>
          <Field label="Payload de teste" className="mt-4"><textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={9} className="w-full rounded-lg border bg-card p-3 font-mono text-xs" /></Field>
          <Btn className="mt-3" onClick={simular}><Zap className="h-4 w-4" />Simular recebimento</Btn>
          <div className="mt-4 space-y-1">{s.webhookLog.map((l, i) => <div key={i} className="flex justify-between rounded-md bg-muted px-3 py-1.5 text-xs"><span>{l.origem}</span><Mono>{new Date(l.at).toLocaleString("pt-BR")}</Mono></div>)}</div>
        </Card>
        <Card title="Usuários e permissões">
          <div className="grid gap-2 sm:grid-cols-4">
            <Input placeholder="Nome" value={u.nome} onChange={(e) => setU({ ...u, nome: e.target.value })} />
            <Input placeholder="E-mail" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} />
            <Select value={u.papel} onChange={(e) => setU({ ...u, papel: e.target.value as Usuario["papel"] })}>{["Admin", "Gerente", "Corretor"].map((x) => <option key={x}>{x}</option>)}</Select>
            <Btn onClick={() => { if (!u.nome) return; setState((x) => ({ ...x, usuarios: [...x.usuarios, { ...u, id: uid() }] })); setU({ id: "", nome: "", email: "", papel: "Corretor" }); }}><Plus className="h-4 w-4" />Adicionar</Btn>
          </div>
          <table className="mt-4 w-full"><thead><tr><Th>Nome</Th><Th>E-mail</Th><Th>Papel</Th><Th /></tr></thead><tbody>
            {s.usuarios.map((x) => <tr key={x.id}><Td>{x.nome}</Td><Td><Mono className="text-xs">{x.email}</Mono></Td>
              <Td><Select value={x.papel} className="py-1 text-xs" onChange={(e) => setState((st) => ({ ...st, usuarios: st.usuarios.map((y) => (y.id === x.id ? { ...y, papel: e.target.value as Usuario["papel"] } : y)) }))}>{["Admin", "Gerente", "Corretor"].map((p) => <option key={p}>{p}</option>)}</Select></Td>
              <Td><Btn variant="danger" onClick={() => setState((st) => ({ ...st, usuarios: st.usuarios.filter((y) => y.id !== x.id) }))}><Trash2 className="h-4 w-4" /></Btn></Td></tr>)}
          </tbody></table>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            {[["Admin", "Acesso total, configurações e integrações"], ["Gerente", "Propostas, rateio, ranking e equipe"], ["Corretor", "Próprias propostas e ranking"]].map(([a, b]) => <div key={a} className="rounded-lg border p-2"><b>{a}</b><p className="text-muted-foreground">{b}</p></div>)}
          </div>
        </Card>
      </div>
    </div>
  );
}
