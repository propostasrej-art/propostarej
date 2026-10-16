import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Printer, Medal } from "lucide-react";
import { Btn, Card, Input, Mono, PageHeader, Pill, Td, Th } from "@/components/kit";
import { useStore } from "@/lib/store";
import { brl, dt } from "@/lib/format";
import { comissaoPct, meta } from "@/lib/helpers";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => meta("Ranking Comercial", "Ranking de vendas por corretor, gerente e diretor."),
  component: Ranking,
});

const PERIODOS = ["Hoje", "Esta Semana", "Este Mês", "Trimestre", "Ano", "Personalizado"] as const;
const SEG = ["Geral", "Corretor", "Gerente", "Diretor Comercial"] as const;

function range(p: (typeof PERIODOS)[number], de: string, ate: string): [string, string] {
  const n = new Date(); const iso = (d: Date) => d.toISOString().slice(0, 10); const t = iso(n);
  if (p === "Hoje") return [t, t];
  if (p === "Esta Semana") { const d = new Date(n); d.setDate(n.getDate() - n.getDay()); return [iso(d), t]; }
  if (p === "Este Mês") return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), t];
  if (p === "Trimestre") return [iso(new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1)), t];
  if (p === "Ano") return [`${n.getFullYear()}-01-01`, t];
  return [de || "1900-01-01", ate || "2999-12-31"];
}

function Ranking() {
  const s = useStore((x) => x);
  const [per, setPer] = useState<(typeof PERIODOS)[number]>("Ano");
  const [seg, setSeg] = useState<(typeof SEG)[number]>("Geral");
  const [modo, setModo] = useState<"integral" | "proporcional">("integral");
  const [de, setDe] = useState(""); const [ate, setAte] = useState("");
  const [a, b] = range(per, de, ate);
  const agg: Record<string, { vgv: number; vendas: number; com: number }> = {};
  s.propostas.filter((p) => p.createdAt >= a && p.createdAt <= b).forEach((p) => {
    const tot = comissaoPct(p);
    p.participantes.forEach((x) => {
      const r = (agg[x.membroId] ??= { vgv: 0, vendas: 0, com: 0 });
      r.vgv += modo === "integral" ? p.vgv : tot ? (p.vgv * x.pct) / tot : 0;
      r.vendas += 1; r.com += (p.vgv * x.pct) / 100;
    });
  });
  const rows = Object.entries(agg).map(([id, v]) => ({ m: s.membros.find((x) => x.id === id)!, ...v }))
    .filter((r) => r.m && r.m.funcao !== "Imobiliária" && r.m.funcao !== "Jurídico" && (seg === "Geral" || r.m.funcao === seg)).sort((x, y) => y.vgv - x.vgv);
  const medal = ["text-warn", "text-muted-foreground", "text-warn-foreground"];
  return (
    <div>
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <PageHeader title="Ranking Comercial de Vendas" actions={<Btn onClick={() => window.print()}><Printer className="h-4 w-4" />Relatório A4</Btn>} />
      <Card className="mb-6 print:hidden">
        <div className="flex flex-wrap gap-2">{PERIODOS.map((x) => <Btn key={x} variant={per === x ? "primary" : "outline"} onClick={() => setPer(x)}>{x}</Btn>)}</div>
        {per === "Personalizado" && <div className="mt-3 flex gap-2"><Input type="date" className="w-44 font-mono" value={de} onChange={(e) => setDe(e.target.value)} /><Input type="date" className="w-44 font-mono" value={ate} onChange={(e) => setAte(e.target.value)} /></div>}
        <div className="mt-3 flex flex-wrap gap-2">{SEG.map((x) => <Btn key={x} variant={seg === x ? "primary" : "ghost"} onClick={() => setSeg(x)}>{x}</Btn>)}
          <span className="mx-2 border-l" />
          <Btn variant={modo === "integral" ? "primary" : "ghost"} onClick={() => setModo("integral")}>VGV Integral</Btn>
          <Btn variant={modo === "proporcional" ? "primary" : "ghost"} onClick={() => setModo("proporcional")}>VGV Proporcional</Btn></div>
      </Card>
      <div className="mb-2 hidden print:block"><h1 className="text-xl font-bold">Relatório de Auditoria e Performance — R&J</h1><p className="text-sm">Período <Mono>{dt(a)}</Mono> a <Mono>{dt(b)}</Mono> · {seg} · VGV {modo}</p></div>
      <div className="mb-6 grid items-end gap-4 sm:grid-cols-3">
        {[1, 0, 2].map((i) => rows[i] && (
          <Card key={i} className={`text-center ${i === 0 ? "sm:pb-10 border-primary" : ""}`}>
            <Medal className={`mx-auto h-10 w-10 ${medal[i]}`} />
            <div className="mt-2 text-xs font-semibold uppercase text-muted-foreground">{["Ouro", "Prata", "Bronze"][i]} · {i + 1}º lugar</div>
            <div className="mt-1 text-lg font-bold">{rows[i].m.nome}</div><Pill>{rows[i].m.funcao}</Pill>
            <Mono className="mt-2 block text-xl font-semibold text-success">{brl(rows[i].vgv)}</Mono>
          </Card>
        ))}
      </div>
      <Card title="Classificação completa"><table className="w-full"><thead><tr><Th>#</Th><Th>Nome</Th><Th>Cargo</Th><Th>CRECI</Th><Th>Vendas</Th><Th>VGV</Th><Th>Comissão</Th></tr></thead><tbody>
        {rows.map((r, i) => <tr key={r.m.id}><Td><Mono>{i + 1}</Mono></Td><Td className="font-medium">{r.m.nome}</Td><Td><Pill>{r.m.funcao}</Pill></Td><Td><Mono>{r.m.creci}</Mono></Td><Td><Mono>{r.vendas}</Mono></Td><Td><Mono>{brl(r.vgv)}</Mono></Td><Td><Mono className="text-success">{brl(r.com)}</Mono></Td></tr>)}
        {!rows.length && <tr><Td className="text-muted-foreground">Sem vendas no período.</Td></tr>}
      </tbody></table></Card>
    </div>
  );
}
