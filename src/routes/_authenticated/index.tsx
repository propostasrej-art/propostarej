import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Mono, PageHeader } from "@/components/kit";
import { useStore } from "@/lib/store";
import { brl } from "@/lib/format";
import { comissaoPct, meta } from "@/lib/helpers";

export const Route = createFileRoute("/_authenticated/")({
  head: () => meta("Dashboard", "Métricas de VGV, comissões e propostas da R&J."),
  component: Dashboard,
});

function Dashboard() {
  const s = useStore((x) => x);
  const vgv = s.propostas.reduce((a, p) => a + p.vgv, 0);
  const com = s.propostas.reduce((a, p) => a + (p.vgv * comissaoPct(p)) / 100, 0);
  const porEmp = s.empreendimentos.map((e) => ({ nome: e.nome, vgv: s.propostas.filter((p) => p.empreendimentoId === e.id).reduce((a, p) => a + p.vgv, 0) }));
  const porMes: Record<string, number> = {};
  s.propostas.forEach((p) => { const k = p.createdAt.slice(0, 7); porMes[k] = (porMes[k] ?? 0) + p.vgv; });
  const periodo = Object.entries(porMes).sort().map(([mes, vgv]) => ({ mes, vgv }));
  const cards = [
    { l: "VGV Total", v: brl(vgv), c: "text-foreground" },
    { l: "Total de Comissões", v: brl(com), c: "text-success" },
    { l: "Propostas em Análise", v: s.propostas.filter((p) => p.status === "Em Análise").length, c: "text-warn-foreground" },
    { l: "Propostas Aprovadas", v: s.propostas.filter((p) => p.status !== "Em Análise").length, c: "text-primary" },
  ];
  const fmt = (v: number) => `${(v / 1000).toFixed(0)}k`;
  return (
    <div>
      <PageHeader title="Painel Dashboard" subtitle="Visão consolidada da carteira de propostas" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.l}><div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.l}</div>
            <Mono className={`mt-2 block text-2xl font-semibold ${c.c}`}>{c.v}</Mono></Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Performance por empreendimento">
          <div className="h-72"><ResponsiveContainer><BarChart data={porEmp}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="nome" fontSize={11} /><YAxis tickFormatter={fmt} fontSize={11} /><Tooltip formatter={(v: number) => brl(v)} />
            <Bar dataKey="vgv" fill="var(--primary)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Card>
        <Card title="Performance por período">
          <div className="h-72"><ResponsiveContainer><BarChart data={periodo}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="mes" fontSize={11} /><YAxis tickFormatter={fmt} fontSize={11} /><Tooltip formatter={(v: number) => brl(v)} />
            <Bar dataKey="vgv" fill="var(--success)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Card>
      </div>
    </div>
  );
}
