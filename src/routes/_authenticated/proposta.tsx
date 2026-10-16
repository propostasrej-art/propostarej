import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Upload, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Field, Input, Mono, PageHeader, Select, Td, Th } from "@/components/kit";
import { getState, setState, useStore, type Proposta, type Status } from "@/lib/store";
import { TIPOS_PARCELA, type TipoParcela } from "@/lib/rateio";
import { brl, pct, uid } from "@/lib/format";
import { meta, somaParcelas } from "@/lib/helpers";
import { useServerFn } from "@tanstack/react-start";
import { extrairProposta } from "@/lib/extracao.functions";
import { nivel, pendentes, precisaRevisao, LIMIAR_REVISAO } from "@/lib/confianca";
import { cn } from "@/lib/utils";
import { Check, ShieldAlert } from "lucide-react";
import { DocViewer } from "@/components/DocViewer";

export const Route = createFileRoute("/_authenticated/proposta")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s["id"] === "string" ? (s["id"] as string) : undefined }),
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
  const [ocr, setOcr] = useState<string | null>(null);
  const extrair = useServerFn(extrairProposta);
  const [conf, setConf] = useState<Record<string, number>>({});
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docAtivo, setDocAtivo] = useState<string | null>(null);
  const [origem, setOrigem] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [ativo, setAtivo] = useState<string | null>(null);
  const atual = docs.find((d) => d.id === docAtivo) ?? null;
  const arquivo = atual?.file ?? null;
  const trechos = atual?.trechos ?? {};
  const rotulos = atual?.rotulos ?? {};
  const marcar = (e: React.SyntheticEvent) => { const k = (e.target as HTMLElement).closest("[data-k]")?.getAttribute("data-k"); if (k) { setAtivo(k); if (origem[k]) setDocAtivo(origem[k]!); } };
  const pick = (k: string) => { setAtivo(k); const el = document.querySelector<HTMLElement>(`[data-k="${k}"]`); (el?.matches("input,select") ? el : el?.querySelector<HTMLElement>("input,select"))?.focus({ preventScroll: false }); };
  useEffect(() => { const f = id && getState().propostas.find((x) => x.id === id); setP(f ? structuredClone(f) : vazia()); setConf({}); setDocs([]); setDocAtivo(null); setOrigem({}); setExtras([]); setAtivo(null); }, [id]);
  const revisar = (k: string) => setConf((c) => { if (!(k in c)) return c; const n = { ...c }; delete n[k]; return n; });
  const rc = (k: string) => (precisaRevisao(conf[k]) ? (nivel(conf[k]!) === "baixa" ? "border-destructive bg-destructive/5 ring-2 ring-destructive/20" : "border-warn bg-warn/10 ring-2 ring-warn/25") : "");
  const L = (label: string, k: string) => {
    const c = conf[k];
    if (c === undefined) return label;
    const n = nivel(c);
    return (<><span>{label}</span>
      <button type="button" onClick={() => revisar(k)} title={n === "alta" ? "Confiança alta" : "Clique para confirmar que revisou"}
        className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-px font-mono text-[10px] font-semibold",
          n === "alta" ? "bg-success/10 text-success" : n === "media" ? "bg-warn/15 text-warn-foreground" : "bg-destructive/10 text-destructive")}>
        {Math.round(c * 100)}%{n !== "alta" && <><span className="font-sans">revisar</span><Check className="h-3 w-3" /></>}
      </button></>);
  };
  const pend = pendentes(conf);

  const up = (patch: Partial<Proposta>) => setP({ ...p, ...patch });
  const soma = somaParcelas(p);
  const ok = p.vgv > 0 && Math.abs(soma - p.vgv) < 0.01;

  function salvar() {
    if (pend.length && !confirm(`${pend.length} campo(s) extraído(s) com baixa confiança ainda não foram revisados. Salvar mesmo assim?`)) { toast.warning("Revise os campos destacados antes de salvar."); return; }
    setState((st) => ({ ...st, propostas: st.propostas.some((x) => x.id === p.id) ? st.propostas.map((x) => (x.id === p.id ? p : x)) : [...st.propostas, p] }));
    toast.success("Proposta salva");
    nav({ to: "/proposta", search: { id: p.id } });
  }
  async function onFile(f: File | undefined, tipo: string, slot: string) {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("Arquivo acima de 10 MB."); return; }
    setOcr(slot);
    try {
      const base64 = await new Promise<string>((ok, err) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] ?? ""); r.onerror = err; r.readAsDataURL(f); });
      const out = await extrair({ data: { filename: f.name, mime: f.type || "application/pdf", base64, tipoDoc: tipo } });
      if (!out.ok) { toast.error(out.erro); return; }
      const d = out.dados;
      const isProp = tipo === "Proposta";
      const docId = uid();
      const nc: Record<string, number> = {};
      const tr: Record<string, string> = {};
      const rot: Record<string, string> = {};
      const nomes: Record<string, string> = { nome: "Nome", cpf: "CPF", rg: "RG", endereco: "Endereço", conjuge: "Cônjuge" };
      const permitidos = CAMPOS_DOC[tipo] ?? ["nome", "cpf", "rg", "endereco", "conjuge"];
      let emp: { id: string } | undefined | "" = undefined;
      let novas: { id: string; tipo: string; valor: number; vencimento: string; confianca: number; trecho: string }[] = [];
      if (isProp) {
        const nomeEmp = d.empreendimento.toLowerCase();
        emp = nomeEmp && s.empreendimentos.find((e) => e.nome.toLowerCase().includes(nomeEmp) || nomeEmp.includes(e.nome.toLowerCase()));
        novas = d.parcelas.map((x) => ({ ...x, id: uid() }));
        (["empreendimento", "unidade", "torre", "vaga", "vgv"] as const).forEach((k) => { nc[k] = k === "empreendimento" && !emp ? 0 : d.confianca[k]; tr[k] = d.trechos[k]; });
        Object.assign(rot, { empreendimento: "Empreendimento", unidade: "Unidade", torre: "Torre", vaga: "Vaga", vgv: "Valor VGV" });
        novas.forEach((x, i) => { nc[`p:${x.id}`] = x.confianca; tr[`p:${x.id}`] = x.trecho; rot[`p:${x.id}`] = `Parcela ${i + 1} · ${x.tipo}`; });
      }
      // Casa cada comprador extraído com um existente (CPF ou nome), senão usa o 1º vazio / novo
      const dig = (v: string) => v.replace(/\D/g, "");
      const compr = p.compradores.map((c) => ({ ...c }));
      d.compradores.forEach((c, n) => {
        let i = compr.findIndex((x) => (dig(c.cpf) && dig(x.cpf) === dig(c.cpf)) || (c.nome && x.nome.trim().toLowerCase() === c.nome.trim().toLowerCase()));
        if (i < 0) i = !isProp && n === 0 ? 0 : compr.findIndex((x) => !x.nome && !x.cpf);
        if (i < 0) { compr.push({ nome: "", cpf: "", rg: "", endereco: "", conjuge: "" }); i = compr.length - 1; }
        const alvo = compr[i]!;
        (Object.keys(nomes) as (keyof typeof alvo)[]).forEach((k) => {
          if (!permitidos.includes(k) || !c[k]) return;
          alvo[k] = c[k];
          nc[`c${i}.${k}`] = c.confianca[k];
          tr[`c${i}.${k}`] = c.trechos[k];
          rot[`c${i}.${k}`] = `Comprador ${i + 1} · ${nomes[k]}`;
        });
      });
      setConf((c) => ({ ...c, ...nc }));
      setOrigem((o) => ({ ...o, ...Object.fromEntries(Object.keys(tr).map((k) => [k, docId])) }));
      setDocs((ds) => [...ds.filter((x) => x.slot !== slot), { id: docId, slot, tipo, file: f, trechos: tr, rotulos: rot }]);
      setDocAtivo(docId); setAtivo(null);
      setP((cur) => ({
        ...cur,
        compradores: compr,
        ...(isProp ? {
          empreendimentoId: emp ? emp.id : cur.empreendimentoId,
          unidade: d.unidade || cur.unidade, torre: d.torre || cur.torre, vaga: d.vaga || cur.vaga, vgv: d.vgv || cur.vgv,
          parcelas: novas.length
            ? novas.map((x) => ({ id: x.id, tipo: (TIPOS_PARCELA as readonly string[]).includes(x.tipo) ? (x.tipo as TipoParcela) : "Mensal", valor: x.valor, vencimento: /^\d{4}-\d{2}-\d{2}$/.test(x.vencimento) ? x.vencimento : cur.createdAt }))
            : cur.parcelas,
        } : {}),
      }));
      const np = pendentes(nc).length;
      if (np) toast.warning(`${tipo}: dados extraídos de "${f.name}". ${np} campo(s) precisam de revisão.`);
      else toast.success(`${tipo}: dados extraídos de "${f.name}".`);
    } catch {
      toast.error("Não foi possível processar o arquivo.");
    } finally { setOcr(null); }
  }
  const slots = [...SLOTS_FIXOS.map((t) => ({ slot: t, tipo: t, extra: false })), ...extras.map((e, i) => ({ slot: e, tipo: `Documento adicional ${i + 1}`, extra: true }))];

  return (
    <div>
      <PageHeader title="Extração & Ficha da Proposta" subtitle={id ? `Editando proposta ${id}` : "Nova proposta"}
        actions={<><Btn variant="outline" onClick={() => nav({ to: "/proposta", search: { id: undefined } })}>Nova</Btn><Btn onClick={salvar}><Save className="h-4 w-4" />Salvar</Btn></>} />
      <div className={cn("grid gap-6", arquivo ? "xl:grid-cols-2" : "xl:grid-cols-3")}>
        <div className={cn("space-y-6", !arquivo && "xl:col-span-2", "[&_[data-k]]:scroll-mt-24")} onFocusCapture={marcar} onClickCapture={marcar}>
          <Card title="Empreendimento e unidade">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={L("Empreendimento", "empreendimento")} className="sm:col-span-2"><Select data-k={"empreendimento"} className={rc("empreendimento")} value={p.empreendimentoId} onChange={(e) => { revisar("empreendimento"); up({ empreendimentoId: e.target.value }); }}>
                {s.empreendimentos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</Select></Field>
              <Field label="Status"><Select value={p.status} onChange={(e) => up({ status: e.target.value as Status })}>
                {["Em Análise", "Aprovada", "Escriturada"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label={L("Unidade", "unidade")}><Input data-k={"unidade"} className={rc("unidade")} value={p.unidade} onChange={(e) => { revisar("unidade"); up({ unidade: e.target.value }); }} /></Field>
              <Field label={L("Torre", "torre")}><Input data-k={"torre"} className={rc("torre")} value={p.torre} onChange={(e) => { revisar("torre"); up({ torre: e.target.value }); }} /></Field>
              <Field label={L("Vaga", "vaga")}><Input data-k={"vaga"} className={rc("vaga")} value={p.vaga} onChange={(e) => { revisar("vaga"); up({ vaga: e.target.value }); }} /></Field>
              <Field label={L("Valor VGV (R$)", "vgv")} className="sm:col-span-3"><Input type="number" className={cn("font-mono", rc("vgv"))} value={p.vgv || ""} onChange={(e) => { revisar("vgv"); up({ vgv: +e.target.value }); }} /></Field>
            </div>
          </Card>
          <Card title="Compradores" action={<Btn variant="ghost" onClick={() => up({ compradores: [...p.compradores, { nome: "", cpf: "", rg: "", endereco: "", conjuge: "" }] })}><Plus className="h-4 w-4" />Comprador</Btn>}>
            <div className="space-y-4">
              {p.compradores.map((c, i) => {
                const set = (k: keyof typeof c, v: string) => { revisar(`c${i}.${k}`); up({ compradores: p.compradores.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }); };
                return (
                  <div key={i} className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-6">
                    <Field label={L("Nome", `c${i}.nome`)} className="sm:col-span-3"><Input data-k={`c${i}.nome`} className={cn("", rc(`c${i}.nome`))} value={c.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
                    <Field label={L("CPF", `c${i}.cpf`)} className="sm:col-span-2"><Input data-k={`c${i}.cpf`} className={cn("font-mono", rc(`c${i}.cpf`))} value={c.cpf} onChange={(e) => set("cpf", e.target.value)} /></Field>
                    <div className="flex items-end"><Btn variant="danger" onClick={() => up({ compradores: p.compradores.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Btn></div>
                    <Field label={L("RG", `c${i}.rg`)} className="sm:col-span-2"><Input data-k={`c${i}.rg`} className={cn("font-mono", rc(`c${i}.rg`))} value={c.rg} onChange={(e) => set("rg", e.target.value)} /></Field>
                    <Field label={L("Cônjuge", `c${i}.conjuge`)} className="sm:col-span-4"><Input data-k={`c${i}.conjuge`} className={cn("", rc(`c${i}.conjuge`))} value={c.conjuge} onChange={(e) => set("conjuge", e.target.value)} /></Field>
                    <Field label={L("Endereço", `c${i}.endereco`)} className="sm:col-span-6"><Input data-k={`c${i}.endereco`} className={cn("", rc(`c${i}.endereco`))} value={c.endereco} onChange={(e) => set("endereco", e.target.value)} /></Field>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title="Série de parcelas" action={<Btn variant="ghost" onClick={() => up({ parcelas: [...p.parcelas, { id: uid(), tipo: "Mensal", valor: 0, vencimento: new Date().toISOString().slice(0, 10) }] })}><Plus className="h-4 w-4" />Parcela</Btn>}>
            <div className="overflow-x-auto"><table className="w-full"><thead><tr><Th>Tipo</Th><Th>Valor</Th><Th>Vencimento</Th><Th>% VGV</Th><Th /></tr></thead><tbody>
              {p.parcelas.map((x) => {
                const set = (patch: object) => { revisar(`p:${x.id}`); up({ parcelas: p.parcelas.map((y) => (y.id === x.id ? { ...y, ...patch } : y)) }); };
                const pc = conf[`p:${x.id}`];
                return (<tr key={x.id} data-k={`p:${x.id}`} className={precisaRevisao(pc) ? (nivel(pc!) === "baixa" ? "bg-destructive/5" : "bg-warn/10") : ""}>
                  <Td><Select className="min-w-40" value={x.tipo} onChange={(e) => set({ tipo: e.target.value })}>{TIPOS_PARCELA.map((t) => <option key={t}>{t}</option>)}</Select></Td>
                  <Td><Input type="number" className="min-w-28 font-mono" value={x.valor || ""} onChange={(e) => set({ valor: +e.target.value })} /></Td>
                  <Td><Input type="date" className="font-mono" value={x.vencimento} onChange={(e) => set({ vencimento: e.target.value })} /></Td>
                  <Td><Mono>{pct(p.vgv ? (x.valor / p.vgv) * 100 : 0)}</Mono>{pc !== undefined && <div className="mt-1 flex gap-1 text-xs">{L("", `p:${x.id}`)}</div>}</Td>
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
              <span className="text-sm font-medium">{ocr ? "Lendo documento com IA..." : "Enviar proposta (PDF/imagem)"}</span>
              <span className="text-xs text-muted-foreground">Os campos são preenchidos automaticamente</span>
              <input type="file" disabled={ocr} accept=".pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </Card>
          {arquivo && (
            <Card title="Documento de origem" className="xl:sticky xl:top-20">
              <DocViewer file={arquivo} trechos={trechos} ativo={ativo} onPick={pick} rotulos={rotulos} />
            </Card>
          )}
          {Object.keys(conf).length > 0 && (
            <Card title="Revisão da extração">
              <div className={cn("flex items-center gap-2 rounded-lg p-3 text-sm font-medium", pend.length ? "bg-warn/15 text-warn-foreground" : "bg-success/10 text-success")}>
                {pend.length ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {pend.length ? `${pend.length} campo(s) precisam de revisão` : "Todos os campos revisados"}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-success transition-all" style={{ width: `${(1 - pend.length / Object.keys(conf).length) * 100}%` }} /></div>
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-success" />Alta (≥ <Mono>{Math.round(LIMIAR_REVISAO * 100)}%</Mono>)</div>
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-warn" />Média — conferir com o documento</div>
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-destructive" />Baixa — provável erro ou ausente</div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Edite o campo ou clique no selo para confirmar a revisão.</p>
              {pend.length > 0 && <Btn variant="outline" className="mt-3 w-full justify-center" onClick={() => setConf((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.max(v, LIMIAR_REVISAO)])))}><Check className="h-4 w-4" />Marcar tudo como revisado</Btn>}
            </Card>
          )}
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
