import { createFileRoute } from "@tanstack/react-router";
import { Copy, MessageCircle, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Field, Input, Mono, PageHeader, Pill, Select, Td, Th, statusTone } from "@/components/kit";
import { setState, useStore, type EnvStatus } from "@/lib/store";
import { dt, uid } from "@/lib/format";
import { meta } from "@/lib/helpers";

export const Route = createFileRoute("/assinaturas")({
  head: () => meta("Assinatura e Cobrança", "Envelopes Assinafy e cobranças Asaas."),
  component: Assin,
});

function Assin() {
  const s = useStore((x) => x);
  const cfg = s.config;
  const setCfg = (patch: Partial<typeof cfg>) => setState((x) => ({ ...x, config: { ...x.config, ...patch } }));
  const novo = () => {
    const p = s.propostas.find((x) => !s.envelopes.some((e) => e.propostaId === x.id)) ?? s.propostas[0];
    if (!p) return;
    const id = "env-" + uid().slice(0, 4);
    setState((x) => ({ ...x, envelopes: [...x.envelopes, { id, propostaId: p.id, status: "Pendente", link: `https://${cfg.sandbox ? "sandbox." : ""}app.assinafy.com.br/sign/${id}`, enviadoEm: new Date().toISOString().slice(0, 10) }] }));
    toast.success(cfg.sandbox ? "Envelope criado (sandbox)" : "Envelope enviado");
  };
  const setSt = (id: string, st: EnvStatus) => setState((x) => ({ ...x, envelopes: x.envelopes.map((e) => (e.id === id ? { ...e, status: st } : e)) }));
  return (
    <div>
      <PageHeader title="Assinatura Eletrônica & Cobrança" subtitle="Assinafy · Asaas" actions={<Btn onClick={novo}><Send className="h-4 w-4" />Novo envelope</Btn>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Envelopes" className="lg:col-span-2"><div className="overflow-x-auto"><table className="w-full"><thead><tr><Th>Envelope</Th><Th>Comprador</Th><Th>Enviado</Th><Th>Status</Th><Th /></tr></thead><tbody>
          {s.envelopes.map((e) => {
            const p = s.propostas.find((x) => x.id === e.propostaId);
            const c = p?.compradores[0];
            return (<tr key={e.id}><Td><Mono>{e.id}</Mono></Td><Td>{c?.nome ?? "—"}</Td><Td><Mono>{dt(e.enviadoEm)}</Mono></Td>
              <Td><Pill tone={statusTone(e.status)}>{e.status}</Pill></Td>
              <Td className="whitespace-nowrap">
                <Btn variant="ghost" aria-label="Copiar link" onClick={() => { navigator.clipboard.writeText(e.link); toast.success("Link copiado"); }}><Copy className="h-4 w-4" /></Btn>
                <a href={`https://wa.me/?text=${encodeURIComponent(`Olá ${c?.nome ?? ""}, segue o link para assinatura do contrato: ${e.link}`)}`} target="_blank" rel="noreferrer"><Btn variant="ghost" aria-label="WhatsApp"><MessageCircle className="h-4 w-4 text-success" /></Btn></a>
                <Select value={e.status} onChange={(ev) => setSt(e.id, ev.target.value as EnvStatus)} className="inline-block w-36 py-1 text-xs">{["Pendente", "Assinado", "Rejeitado", "Não Encontrado"].map((x) => <option key={x}>{x}</option>)}</Select>
              </Td></tr>);
          })}
        </tbody></table></div></Card>
        <Card title="Configuração de API">
          <div className="space-y-4">
            <Field label="Assinafy API Token"><Input type="password" className="font-mono" value={cfg.assinafyToken} onChange={(e) => setCfg({ assinafyToken: e.target.value })} placeholder="asf_..." /></Field>
            <Field label="Asaas API Token"><Input type="password" className="font-mono" value={cfg.asaasToken} onChange={(e) => setCfg({ asaasToken: e.target.value })} placeholder="$aact_..." /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.sandbox} onChange={(e) => setCfg({ sandbox: e.target.checked })} className="accent-primary" />Modo Sandbox (testes)</label>
            <Btn variant="outline" onClick={() => toast.info(cfg.sandbox ? "Sandbox ativo: status simulados" : cfg.assinafyToken ? "Token salvo" : "Informe o token")}><RefreshCw className="h-4 w-4" />Testar conexão</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
