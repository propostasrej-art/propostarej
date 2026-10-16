import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Upload, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Field, Input, Mono, PageHeader, Select, Td, Th } from "@/components/kit";
import { getState, setState, useStore, type Proposta, type Status } from "@/lib/store";
import { TIPOS_PARCELA, type TipoParcela } from "@/lib/rateio";
import { brl, pct, uid } from "@/lib/format";
import { meta, somaParcelas } from "@/lib/helpers";

export const Route = createFileRoute("/proposta")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  head: () => meta("Ficha da Proposta", "Cadastro e extração de dados de propostas imobiliárias."),
  component: Ficha,
});

const vazia = (): Proposta => ({
  id: uid(), status: "Em Análise", empreendimentoId: getState().empreendimentos[0]?.id ?? "", unidade: "", torre: "", vaga: "", vgv: 0,
  compradores: [{ nome: "", cpf: "", rg: "", endereco: "", conjuge: "" }], parcelas: [], participantes: [], createdAt: new Date().toISOString().slice(0, 10),
});

function Ficha() {
  const { id } = Route.useSearch();
  const nav = useNavigate();
  const s = useStore((x) => x);
  const [p, setP] = useState<Proposta>(vazia);
  const [ocr, setOcr] = useState(false);
  useEffect(() => { const f = id && getState().propostas.find((x) => x.id === id); setP(f ? structuredClone(f) : vazia()); }, [id]);

  const up = (patch: Partial<Proposta>) => setP({ ...p, ...patch });
  const soma = somaParcelas(p);
  const ok = p.vgv > 0 && Math.abs(soma - p.vgv) < 0.01;

  function salvar() {
    setState((st) => ({ ...st, propostas: st.propostas.some((x) => x.id === p.id) ? st.propostas.map((x) => (x.id === p.id ? p : x)) : [...st.propostas, p] }));
    toast.success("Proposta salva");
    nav({ to: "/proposta", search: { id: p.id } });
  }
  function onFile(f?: File) {
    if (!f) return;
    setOcr(true);
    setTimeout(() => {
      const vgv = 780000;
      const hoje = new Date();
      const dd = (m: number) => new Date(hoje.getFullYear(), hoje.getMonth() + m, 10).toISOString().slice(0, 10);
      setP((cur) => ({
        ...cur, unidade: "1507", torre: "C", vaga: "88", vgv,
        compradores: [{ nome: "Mariana Souza Prado", cpf: "456.123.789-10", rg: "45.678.123-4", endereco: "R. Bela Cintra, 300 — São Paulo/SP", conjuge: "Diego Prado" }],
        parcelas: [
          { id: uid(), tipo: "Sinal/Ato", valor: 39000, vencimento: dd(0) },
          ...Array.from({ length: 10 }, (_, i) => ({ id: uid(), tipo: "Mensal" as TipoParcela, valor: 7800, vencimento: dd(i + 1) })),
          { id: uid(), tipo: "Chaves", valor: 39000, vencimento: dd(14) },
          { id: uid(), tipo: "FGTS", valor: 46000, vencimento: dd(15) },
          { id: uid(), tipo: "Financiamento Bancário", valor: 578000, vencimento: dd(15) },
        ],
      }));
      setOcr(false);
      toast.success(`OCR concluído: dados extraídos de "${f.name}"`);
    }, 1400);
  }

  return (
    <div>
      <PageHeader title="Extração & Ficha da Proposta" subtitle={id ? `Editando proposta ${id}` : "Nova proposta"}
        actions={<><Btn variant="outline" onClick={() => nav({ to: "/proposta", search: { id: undefined } })}>Nova</Btn><Btn onClick={salvar}><Save className="h-4 w-4" />Salvar</Btn></>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Empreendimento e unidade">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Empreendimento" className="sm:col-span-2"><Select value={p.empreendimentoId} onChange={(e) => up({ empreendimentoId: e.target.value })}>
                {s.empreendimentos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</Select></Field>
              <Field label="Status"><Select value={p.status} onChange={(e) => up({ status: e.target.value as Status })}>
                {["Em Análise", "Aprovada", "Escriturada"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="Unidade"><Input value={p.unidade} onChange={(e) => up({ unidade: e.target.value })} /></Field>
              <Field label="Torre"><Input value={p.torre} onChange={(e) => up({ torre: e.target.value })} /></Field>
              <Field label="Vaga"><Input value={p.vaga} onChange={(e) => up({ vaga: e.target.value })} /></Field>
              <Field label="Valor VGV (R$)" className="sm:col-span-3"><Input type="number" className="font-mono" value={p.vgv || ""} onChange={(e) => up({ vgv: +e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="Compradores" action={<Btn variant="ghost" onClick={() => up({ compradores: [...p.compradores, { nome: "", cpf: "", rg: "", endereco: "", conjuge: "" }] })}><Plus className="h-4 w-4" />Comprador</Btn>}>
            <div className="space-y-4">
              {p.compradores.map((c, i) => {
                const set = (k: keyof typeof c, v: string) => up({ compradores: p.compradores.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
                return (
                  <div key={i} className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-6">
                    <Field label="Nome" className="sm:col-span-3"><Input value={c.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
                    <Field label="CPF" className="sm:col-span-2"><Input className="font-mono" value={c.cpf} onChange={(e) => set("cpf", e.target.value)} /></Field>
                    <div className="flex items-end"><Btn variant="danger" onClick={() => up({ compradores: p.compradores.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Btn></div>
                    <Field label="RG" className="sm:col-span-2"><Input className="font-mono" value={c.rg} onChange={(e) => set("rg", e.target.value)} /></Field>
                    <Field label="Cônjuge" className="sm:col-span-4"><Input value={c.conjuge} onChange={(e) => set("conjuge", e.target.value)} /></Field>
                    <Field label="Endereço" className="sm:col-span-6"><Input value={c.endereco} onChange={(e) => set("endereco", e.target.value)} /></Field>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title="Série de parcelas" action={<Btn variant="ghost" onClick={() => up({ parcelas: [...p.parcelas, { id: uid(), tipo: "Mensal", valor: 0, vencimento: new Date().toISOString().slice(0, 10) }] })}><Plus className="h-4 w-4" />Parcela</Btn>}>
            <div className="overflow-x-auto"><table className="w-full"><thead><tr><Th>Tipo</Th><Th>Valor</Th><Th>Vencimento</Th><Th>% VGV</Th><Th /></tr></thead><tbody>
              {p.parcelas.map((x) => {
                const set = (patch: object) => up({ parcelas: p.parcelas.map((y) => (y.id === x.id ? { ...y, ...patch } : y)) });
                return (<tr key={x.id}>
                  <Td><Select value={x.tipo} onChange={(e) => set({ tipo: e.target.value })}>{TIPOS_PARCELA.map((t) => <option key={t}>{t}</option>)}</Select></Td>
                  <Td><Input type="number" className="font-mono" value={x.valor || ""} onChange={(e) => set({ valor: +e.target.value })} /></Td>
                  <Td><Input type="date" className="font-mono" value={x.vencimento} onChange={(e) => set({ vencimento: e.target.value })} /></Td>
                  <Td><Mono>{pct(p.vgv ? (x.valor / p.vgv) * 100 : 0)}</Mono></Td>
                  <Td><Btn variant="danger" onClick={() => up({ parcelas: p.parcelas.filter((y) => y.id !== x.id) })}><Trash2 className="h-4 w-4" /></Btn></Td>
                </tr>);
              })}
              {!p.parcelas.length && <tr><Td className="text-center text-muted-foreground">Nenhuma parcela cadastrada.</Td></tr>}
            </tbody></table></div>
          </Card>
          <Card title="Participantes do rateio (% sobre VGV)" action={<Btn variant="ghost" onClick={() => up({ participantes: [...p.participantes, { membroId: s.membros[0]?.id ?? "", pct: 1 }] })}><Plus className="h-4 w-4" />Participante</Btn>}>
            <div className="space-y-2">
              {p.participantes.map((x, i) => (
                <div key={i} className="flex gap-2">
                  <Select value={x.membroId} onChange={(e) => up({ participantes: p.participantes.map((y, j) => (j === i ? { ...y, membroId: e.target.value } : y)) })}>
                    {s.membros.map((m) => <option key={m.id} value={m.id}>{m.nome} — {m.funcao}</option>)}</Select>
                  <Input type="number" step="0.1" className="w-28 font-mono" value={x.pct} onChange={(e) => up({ participantes: p.participantes.map((y, j) => (j === i ? { ...y, pct: +e.target.value } : y)) })} />
                  <Btn variant="danger" onClick={() => up({ participantes: p.participantes.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Btn>
                </div>
              ))}
              <div className="pt-2 text-sm text-muted-foreground">Comissão global: <Mono className="font-semibold text-success">{pct(p.participantes.reduce((a, b) => a + b.pct, 0))}</Mono></div>
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Upload & OCR">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center hover:border-primary">
              <Upload className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">{ocr ? "Processando OCR..." : "Enviar proposta (PDF/imagem)"}</span>
              <span className="text-xs text-muted-foreground">Os campos são preenchidos automaticamente</span>
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </Card>
          <Card title="Validador de VGV">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>VGV</span><Mono>{brl(p.vgv)}</Mono></div>
              <div className="flex justify-between"><span>Soma das parcelas</span><Mono>{brl(soma)}</Mono></div>
              <div className="flex justify-between"><span>Cobertura</span><Mono>{pct(p.vgv ? (soma / p.vgv) * 100 : 0)}</Mono></div>
              <div className="flex justify-between"><span>Diferença</span><Mono className={ok ? "text-success" : "text-destructive"}>{brl(p.vgv - soma)}</Mono></div>
            </div>
            <div className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-sm font-medium ${ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{ok ? "Parcelas fecham 100% do VGV" : "Parcelas não fecham com o VGV"}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
