import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Field, Input, Mono, PageHeader, Select, Td, Th } from "@/components/kit";
import { ParcelasTable } from "@/components/ParcelasTable";
import { getState, setState, useStore, type Proposta, type Status } from "@/lib/store";
import { nomesTiposParcela } from "@/lib/tipos-parcela";
import { brl, dt, pct, uid } from "@/lib/format";
import { meta, rateioDaProposta, somaParcelas } from "@/lib/helpers";
import { agruparParcelas } from "@/lib/parcelas-tabela";
import { useServerFn } from "@tanstack/react-start";
import { extrairProposta } from "@/lib/extracao.functions";
import { nivel, pendentes, precisaRevisao, LIMIAR_REVISAO } from "@/lib/confianca";
import { cn } from "@/lib/utils";
import { Check, ShieldAlert, FileText, Camera } from "lucide-react";
import { DocViewer } from "@/components/DocViewer";
import { BancoDocumentos } from "@/components/BancoDocumentos";
import { chaveDocumentos, guardarDocumento, listarDocumentos, type DocumentoLocal } from "@/lib/documentos";
import { validarDocumento } from "@/lib/documentos-regras";
import { useQueryClient } from "@tanstack/react-query";

type Doc = DocumentoLocal;
const SLOTS_FIXOS = ["Documento de identidade (RG/CNH)", "CPF", "Comprovante de residência", "Comprovante de estado civil", "Proposta"];
// Campos do comprador que cada tipo de documento pode preencher
const CAMPOS_DOC: Record<string, string[]> = {
  "Documento de identidade (RG/CNH)": ["nome", "cpf", "rg", "nascimento", "nacionalidade"],
  CPF: ["nome", "cpf", "nascimento"],
  "Comprovante de residência": ["nome", "endereco"],
  "Comprovante de estado civil": ["nome", "cpf", "conjuge", "estadoCivil"],
};

const NOMES_C: Record<string, string> = { nome: "Nome", cpf: "CPF", rg: "RG", endereco: "Endereço", conjuge: "Cônjuge", nascimento: "Nascimento", estadoCivil: "Estado civil", profissao: "Profissão", nacionalidade: "Nacionalidade", email: "E-mail", telefone: "Telefone" };
const ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "text/plain"];
const tipoDe = (f: File) => f.type || (/\.txt$/i.test(f.name) ? "text/plain" : /\.pdf$/i.test(f.name) ? "application/pdf" : "");
// Reduz fotos grandes para no máx. 1600px, fundo branco, JPEG 82% (também converte GIF)
async function otimizarImagem(f: File): Promise<File> {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    if (k === 1 && f.type !== "image/gif" && f.size < 1.5 * 1024 * 1024) return f;
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.82));
    return blob ? new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
  } finally { URL.revokeObjectURL(url); }
}

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
  const cache = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const manterDocumentos = useRef(false);
  const [ocr, setOcr] = useState<string | null>(null);
  const extrair = useServerFn(extrairProposta);
  const [conf, setConf] = useState<Record<string, number>>({});
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docAtivo, setDocAtivo] = useState<string | null>(null);
  const [origem, setOrigem] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const atual = docs.find((d) => d.id === docAtivo) ?? null;
  const arquivo = atual?.file ?? null;
  const trechos = atual?.trechos ?? {};
  const rotulos = atual?.rotulos ?? {};
  const marcar = (e: React.SyntheticEvent) => { const k = (e.target as HTMLElement).closest("[data-k]")?.getAttribute("data-k"); if (k) { setAtivo(k); if (origem[k]) setDocAtivo(origem[k]!); } };
  const pick = (k: string) => { setAtivo(k); const el = document.querySelector<HTMLElement>(`[data-k="${k}"]`); (el?.matches("input,select") ? el : el?.querySelector<HTMLElement>("input,select"))?.focus({ preventScroll: false }); };
  useEffect(() => { if (manterDocumentos.current) { manterDocumentos.current = false; return; } const f = id && getState().propostas.find((x) => x.id === id); setP(f ? structuredClone(f) : vazia()); setConf({}); setDocs([]); setDocAtivo(null); setOrigem({}); setExtras([]); setAtivo(null); }, [id]);
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

  async function salvar() {
    if (pend.length && !confirm(`${pend.length} campo(s) extraído(s) com baixa confiança ainda não foram revisados. Salvar mesmo assim?`)) { toast.warning("Revise os campos destacados antes de salvar."); return; }
    setSalvando(true);
    try {
      const sucesso = await setState((st) => ({ ...st, propostas: st.propostas.some((x) => x.id === p.id) ? st.propostas.map((x) => (x.id === p.id ? p : x)) : [...st.propostas, p] }));
      if (!sucesso) return;
      const existentes = await listarDocumentos(p.id);
      for (const doc of docs.filter((d) => !d.salvo && !existentes.some((x) => x.id === d.id))) {
        await guardarDocumento(p.id, doc);
        setDocs((ds) => ds.map((d) => d.id === doc.id ? { ...d, salvo: true } : d));
      }
      await cache.invalidateQueries({ queryKey: chaveDocumentos(p.id) });
      toast.success("Proposta e documentos salvos.");
      // Avoid resetting the extracted field sources after the first save.
      if (id !== p.id) manterDocumentos.current = true;
      await nav({ to: "/proposta", search: { id: p.id } });
    } catch { toast.error("A proposta foi salva, mas alguns documentos não. Clique em Salvar para tentar novamente."); }
    finally { setSalvando(false); }
  }
  async function onFile(f0: File | undefined, tipo: string, slot: string) {
    if (!f0) return;
    const erroArquivo = validarDocumento(f0);
    if (erroArquivo) { toast.error(erroArquivo); return; }
    if (f0.size === 0) { toast.error("Arquivo vazio ou corrompido."); return; }
    const mime = tipoDe(f0);
    if (!ACEITOS.includes(mime)) { toast.error("Formato não suportado. Use PDF, JPG, PNG, WEBP, GIF ou TXT."); return; }
    let f = f0;
    if (mime.startsWith("image/")) { try { f = await otimizarImagem(f0); } catch { toast.error("Imagem corrompida."); return; } }
    if (f.size > 10 * 1024 * 1024) { toast.error("Arquivo acima de 10 MB."); return; }
    const docId = uid();
    // Archive the original upload even when AI extraction fails.
    setDocs((ds) => [...ds, { id: docId, slot, tipo, file: f0, trechos: {}, rotulos: {} }]);
    setOcr(slot);
    try {
      const base64 = await new Promise<string>((ok, err) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] ?? ""); r.onerror = err; r.readAsDataURL(f); });
      const out = await extrair({ data: { filename: f.name, mime: mime.startsWith("image/") ? f.type : mime, base64, tipoDoc: tipo } });
      if (!out.ok) { toast.error(out.erro); return; }
      const d = out.dados;
      const isProp = tipo === "Proposta";
      const nc: Record<string, number> = {};
      const tr: Record<string, string> = {};
      const rot: Record<string, string> = {};
      const nomes = NOMES_C;
      const permitidos = CAMPOS_DOC[tipo] ?? Object.keys(NOMES_C);
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
        (Object.keys(nomes) as (keyof typeof c & keyof typeof alvo)[]).forEach((k) => {
          if (!permitidos.includes(k) || !c[k]) return;
          alvo[k] = c[k];
          nc[`c${i}.${k}`] = c.confianca?.[k] ?? 0.5;
          tr[`c${i}.${k}`] = c.trechos?.[k] ?? "";
          rot[`c${i}.${k}`] = `Comprador ${i + 1} · ${nomes[k]}`;
        });
      });
      // Equipe de vendas: cruza nomes com o cadastro de Equipe
      const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const acha = (n: string) => { const x = norm(n); return x ? s.membros.find((m) => norm(m.nome).includes(x) || x.includes(norm(m.nome)) || (m.apelido && norm(m.apelido) === x)) : undefined; };
      const equipe = isProp && d.equipe ? [d.equipe.corretor1, d.equipe.corretor2, d.equipe.gerente].map(acha).filter((m): m is NonNullable<typeof m> => !!m) : [];
      const naoAchados = isProp && d.equipe ? [d.equipe.corretor1, d.equipe.corretor2, d.equipe.gerente].filter((n) => n && !acha(n)) : [];
      if (naoAchados.length) toast.info(`Não encontrados na Equipe: ${naoAchados.join(", ")}.`);
      setConf((c) => ({ ...c, ...nc }));
      setOrigem((o) => ({ ...o, ...Object.fromEntries(Object.keys(tr).map((k) => [k, docId])) }));
      setDocs((ds) => ds.map((x) => x.id === docId ? { ...x, trechos: tr, rotulos: rot } : x));
      setDocAtivo(docId); setAtivo(null);
      setP((cur) => ({
        ...cur,
        compradores: compr,
        ...(isProp ? {
          empreendimentoId: emp ? emp.id : cur.empreendimentoId,
          unidade: d.unidade || cur.unidade, torre: d.torre || cur.torre, vaga: d.vaga || cur.vaga, vgv: d.vgv || cur.vgv,
          parcelas: novas.length
            ? novas.map((x) => ({ id: x.id, tipo: nomesTiposParcela(s.tiposParcela).includes(x.tipo) ? x.tipo : "Mensal", valor: x.valor, vencimento: /^\d{4}-\d{2}-\d{2}$/.test(x.vencimento) ? x.vencimento : cur.createdAt }))
            : cur.parcelas,
          participantes: cur.participantes.length || !equipe.length ? cur.participantes
            : [...new Map(equipe.map((m) => [m.id, { membroId: m.id, pct: 1 }])).values()],
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
  const removerDoc = (docId: string) => {
    setDocs((ds) => ds.filter((d) => d.id !== docId));
    setOrigem((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== docId)));
    if (docAtivo === docId) { setDocAtivo(null); setAtivo(null); }
  };

  return (
    <div>
      <PageHeader title="Extração & Ficha da Proposta" subtitle={id ? `Editando proposta ${id}` : "Nova proposta"}
        actions={<><Btn variant="outline" disabled={salvando || !!ocr} onClick={() => nav({ to: "/proposta", search: { id: undefined } })}>Nova</Btn><Btn disabled={salvando || !!ocr} onClick={salvar}><Save className="h-4 w-4" />{salvando ? "Salvando..." : "Salvar"}</Btn></>} />
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
                    <Field label={L("Nascimento", `c${i}.nascimento`)} className="sm:col-span-2"><Input type="date" data-k={`c${i}.nascimento`} className={cn("font-mono", rc(`c${i}.nascimento`))} value={c.nascimento ?? ""} onChange={(e) => set("nascimento", e.target.value)} /></Field>
                    <Field label={L("Estado civil", `c${i}.estadoCivil`)} className="sm:col-span-2"><Input data-k={`c${i}.estadoCivil`} className={rc(`c${i}.estadoCivil`)} value={c.estadoCivil ?? ""} onChange={(e) => set("estadoCivil", e.target.value)} /></Field>
                    <Field label={L("Nacionalidade", `c${i}.nacionalidade`)} className="sm:col-span-2"><Input data-k={`c${i}.nacionalidade`} className={rc(`c${i}.nacionalidade`)} value={c.nacionalidade ?? ""} onChange={(e) => set("nacionalidade", e.target.value)} /></Field>
                    <Field label={L("Profissão", `c${i}.profissao`)} className="sm:col-span-2"><Input data-k={`c${i}.profissao`} className={rc(`c${i}.profissao`)} value={c.profissao ?? ""} onChange={(e) => set("profissao", e.target.value)} /></Field>
                    <Field label={L("E-mail", `c${i}.email`)} className="sm:col-span-2"><Input type="email" data-k={`c${i}.email`} className={rc(`c${i}.email`)} value={c.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
                    <Field label={L("Telefone", `c${i}.telefone`)} className="sm:col-span-2"><Input data-k={`c${i}.telefone`} className={cn("font-mono", rc(`c${i}.telefone`))} value={c.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} /></Field>
                  </div>
                );
              })}
            </div>
          </Card>
          <ParcelasTable key={p.id} parcelas={p.parcelas} onChange={(parcelas) => up({ parcelas })}
            revisar={(id) => revisar(`p:${id}`)} indicador={(id) => conf[`p:${id}`] === undefined ? null : L("", `p:${id}`)}
            destaque={(ids) => ids.some((id) => { const c = conf[`p:${id}`]; return c !== undefined && nivel(c) === "baixa" && precisaRevisao(c); }) ? "bg-destructive/5" : ids.some((id) => precisaRevisao(conf[`p:${id}`])) ? "bg-warn/10" : ""} />
          {(() => { const { res } = rateioDaProposta(s, p); const totalLiquido = res.eventos.reduce((a, e) => a + e.liquidaFluxo, 0);
            return (
              <Card title="Tabela de valor líquido do imóvel">
                <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead><tr>
                  <Th>Quantidade</Th><Th>Tipo de parcela</Th><Th>Valor unitário</Th><Th>1.º vencimento</Th><Th>(–) Comissão</Th><Th>Total líquido</Th>
                </tr></thead><tbody>
                  {agruparParcelas(p.parcelas).map((l) => {
                    const evs = res.eventos.filter((e) => l.ids.includes(e.parcela.id));
                    const pools = evs.map((e) => e.pool);
                    const uniforme = pools.length > 0 && pools.every((x) => Math.abs(x - (pools[0] ?? 0)) < 0.005);
                    const protegida = evs.length > 0 && evs.every((e) => e.pool === 0);
                    return (
                      <tr key={l.id} className={protegida ? "bg-muted/50" : ""}>
                        <Td><Mono>{l.quantidade}</Mono></Td>
                        <Td>{l.tipo}</Td>
                        <Td><Mono>{brl(l.valor)}</Mono></Td>
                        <Td><Mono>{dt(l.vencimento)}</Mono></Td>
                        <Td><Mono className={protegida ? "text-muted-foreground" : ""}>{uniforme ? brl(pools[0]) : brl(pools.reduce((a, x) => a + x, 0))}</Mono></Td>
                        <Td><Mono className="whitespace-nowrap font-semibold text-success">{brl(evs.reduce((a, e) => a + e.liquidaFluxo, 0))}</Mono></Td>
                      </tr>
                    );
                  })}
                  {!res.eventos.length && <tr><td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Nenhuma parcela cadastrada.</td></tr>}
                </tbody><tfoot><tr>
                  <td colSpan={4} className="px-3 pt-4 text-right text-sm font-semibold">Total</td>
                  <td className="px-3 pt-4"><Mono className="whitespace-nowrap font-semibold">{brl(res.eventos.reduce((a, e) => a + e.pool, 0))}</Mono></td>
                  <td className="px-3 pt-4"><Mono className="whitespace-nowrap font-semibold">{brl(res.eventos.reduce((a, e) => a + e.pool, 0))}</Mono></td>
                  <td className="px-3 pt-4"><Mono className="whitespace-nowrap font-semibold text-success">{brl(totalLiquido)}</Mono></td>
                </tr></tfoot></table></div>
                <p className="mt-3 text-xs text-muted-foreground">Parcelas protegidas (Financiamento Bancário, FGTS, Subsídio) não deduzem comissão; o líquido delas é o valor integral.</p>
              </Card>
            ); })()}
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
          <BancoDocumentos propostaId={p.id} salva={s.propostas.some((x) => x.id === p.id)} locais={docs} disabled={salvando || !!ocr}
            onAdd={(files, tipo) => {
              const novos: Doc[] = [];
              for (const file of files) {
                const erro = validarDocumento(file);
                if (erro) { toast.error(`${file.name}: ${erro}`); continue; }
                novos.push({ id: uid(), slot: uid(), tipo, file, trechos: {}, rotulos: {} });
              }
              setDocs((ds) => [...ds, ...novos]);
            }}
            onOpen={(d) => { setDocs((ds) => [...ds.filter((x) => x.id !== d.id), d]); setDocAtivo(d.id); setAtivo(null); setOrigem((o) => ({ ...o, ...Object.fromEntries(Object.keys(d.trechos).map((k) => [k, d.id])) })); }}
            onRemove={removerDoc} />
          <Card title="Documentos para extração" action={<Btn variant="ghost" onClick={() => setExtras((e) => [...e, uid()])}><Plus className="h-4 w-4" />Adicionar documento</Btn>}>
            <div className="space-y-2">
              {slots.map(({ slot, tipo, extra }) => {
                const d = [...docs].reverse().find((x) => x.slot === slot);
                const lendo = ocr === slot;
                return (
                  <div key={slot} onDragOver={(e) => { e.preventDefault(); setSobre(slot); }} onDragLeave={() => setSobre((x) => (x === slot ? null : x))}
                    onDrop={(e) => { e.preventDefault(); setSobre(null); if (!ocr) onFile(e.dataTransfer.files?.[0], extra ? "Documento adicional" : tipo, slot); }}
                    className={cn("flex items-center gap-2 rounded-lg border p-2.5 transition-colors", d && docAtivo === d.id && "border-primary bg-primary/5", sobre === slot && "border-dashed border-primary bg-primary/10")}>
                    <FileText className={cn("h-5 w-5 shrink-0", d ? "text-success" : "text-muted-foreground")} />
                    <button type="button" disabled={!d} onClick={() => d && setDocAtivo(d.id)} className="min-w-0 flex-1 text-left">
                      <div className="text-sm font-medium">{tipo}</div>
                      <div className="truncate text-xs text-muted-foreground">{lendo ? "Lendo com IA..." : d ? d.file.name : "Nenhum arquivo"}</div>
                    </button>
                    <label className={cn("inline-flex cursor-pointer items-center gap-1 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted", ocr && "pointer-events-none opacity-50")}>
                      <Upload className="h-3.5 w-3.5" />{d ? "Trocar" : "Enviar"}
                      <input type="file" disabled={!!ocr} accept=".pdf,.txt,image/png,image/jpeg,image/webp,image/gif,text/plain" className="hidden" onChange={(e) => { onFile(e.target.files?.[0], extra ? "Documento adicional" : tipo, slot); e.target.value = ""; }} />
                    </label>
                    <label title="Fotografar com a câmera" className={cn("inline-flex cursor-pointer items-center rounded-lg border bg-card px-2 py-1.5 hover:bg-muted", ocr && "pointer-events-none opacity-50")}>
                      <Camera className="h-3.5 w-3.5" /><span className="sr-only">Câmera</span>
                      <input type="file" disabled={!!ocr} accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files?.[0], extra ? "Documento adicional" : tipo, slot); e.target.value = ""; }} />
                    </label>
                    {extra && <Btn variant="danger" className="px-2" onClick={() => { setExtras((x) => x.filter((y) => y !== slot)); }}><Trash2 className="h-4 w-4" /></Btn>}
                  </div>
                );
              })}
              <p className="pt-1 text-xs text-muted-foreground">Arraste o arquivo, envie ou fotografe. PDF, JPG, PNG, WEBP, GIF ou TXT até 10 MB; fotos são otimizadas antes do envio. Os campos da ficha são preenchidos automaticamente.</p>
            </div>
          </Card>
          {arquivo && (
            <Card title={`Documento de origem · ${atual?.tipo ?? ""}`} className="xl:sticky xl:top-20">
              <DocViewer key={atual?.id} file={arquivo} trechos={trechos} ativo={ativo} onPick={pick} rotulos={rotulos} />
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
