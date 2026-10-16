import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Eye, Trash2 } from "lucide-react";
import { Btn, Card, Input, Mono, PageHeader, Pill, Select, Td, Th, statusTone } from "@/components/kit";
import { setState, useStore, type Status } from "@/lib/store";
import { brl, dt } from "@/lib/format";
import { meta } from "@/lib/helpers";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => meta("Inbox de Propostas", "Lista de propostas com busca e filtros de status."),
  component: InboxPage,
});

function InboxPage() {
  const s = useStore((x) => x);
  const [q, setQ] = useState("");
  const [f, setF] = useState("Todas");
  const [view, setView] = useState<string | null>(null);
  const list = s.propostas.filter((p) => (f === "Todas" || p.status === f) &&
    `${p.unidade} ${p.compradores.map((c) => c.nome + c.cpf).join(" ")} ${s.empreendimentos.find((e) => e.id === p.empreendimentoId)?.nome}`.toLowerCase().includes(q.toLowerCase()));
  const sel = s.propostas.find((p) => p.id === view);
  const setStatus = (id: string, st: Status) => setState((x) => ({ ...x, propostas: x.propostas.map((p) => (p.id === id ? { ...p, status: st } : p)) }));
  return (
    <div>
      <PageHeader title="Inbox de Propostas" subtitle={`${s.propostas.length} propostas salvas`} actions={<Link to="/proposta" search={{ id: undefined }}><Btn>Nova proposta</Btn></Link>} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <Input placeholder="Buscar por comprador, CPF, unidade, empreendimento..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
          {["Todas", "Em Análise", "Aprovada", "Escriturada"].map((x) => <Btn key={x} variant={f === x ? "primary" : "outline"} onClick={() => setF(x)}>{x}</Btn>)}
        </div>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr><Th>Data</Th><Th>Empreendimento</Th><Th>Unidade</Th><Th>Comprador</Th><Th>VGV</Th><Th>Status</Th><Th /></tr></thead><tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <Td><Mono>{dt(p.createdAt)}</Mono></Td><Td>{s.empreendimentos.find((e) => e.id === p.empreendimentoId)?.nome}</Td>
              <Td><Mono>{p.torre}-{p.unidade}</Mono></Td><Td>{p.compradores[0]?.nome}<div className="font-mono text-xs text-muted-foreground">{p.compradores[0]?.cpf}</div></Td>
              <Td><Mono className="text-success">{brl(p.vgv)}</Mono></Td>
              <Td><Select value={p.status} onChange={(e) => setStatus(p.id, e.target.value as Status)} className="w-36 py-1 text-xs">{["Em Análise", "Aprovada", "Escriturada"].map((x) => <option key={x}>{x}</option>)}</Select></Td>
              <Td className="whitespace-nowrap">
                <Btn variant="ghost" onClick={() => setView(p.id)} aria-label="Visualizar"><Eye className="h-4 w-4" /></Btn>
                <Link to="/proposta" search={{ id: p.id }}><Btn variant="ghost" aria-label="Editar"><Pencil className="h-4 w-4" /></Btn></Link>
                <Btn variant="danger" aria-label="Excluir" onClick={() => confirm("Excluir proposta?") && setState((x) => ({ ...x, propostas: x.propostas.filter((y) => y.id !== p.id) }))}><Trash2 className="h-4 w-4" /></Btn>
              </Td>
            </tr>
          ))}
          {!list.length && <tr><Td className="text-muted-foreground">Nenhuma proposta encontrada.</Td></tr>}
        </tbody></table></div>
      </Card>
      {sel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" onClick={() => setView(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Unidade {sel.torre}-{sel.unidade}</h3><Pill tone={statusTone(sel.status)}>{sel.status}</Pill></div>
            <div className="mt-4 space-y-1 text-sm">
              <div>VGV: <Mono className="text-success">{brl(sel.vgv)}</Mono> · Vaga <Mono>{sel.vaga}</Mono></div>
              {sel.compradores.map((c, i) => <div key={i}>{c.nome} — <Mono>{c.cpf}</Mono>{c.conjuge && ` · Cônjuge: ${c.conjuge}`}</div>)}
              <div className="pt-2 font-medium">Parcelas</div>
              {sel.parcelas.map((x) => <div key={x.id} className="flex justify-between"><span>{x.tipo} · <Mono>{dt(x.vencimento)}</Mono></span><Mono>{brl(x.valor)}</Mono></div>)}
            </div>
            <Btn className="mt-4" variant="outline" onClick={() => setView(null)}>Fechar</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
