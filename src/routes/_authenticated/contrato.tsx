import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Printer, FileDown, Send } from "lucide-react";
import { toast } from "sonner";
import { Btn, PageHeader, Select } from "@/components/kit";
import { PropostaPicker } from "@/components/PropostaPicker";
import { setState, useStore, type Membro } from "@/lib/store";
import type { ParcelaIn } from "@/lib/rateio";
import { agruparParcelas, totalLinha, vencimentoParcela, type LinhaParcelas } from "@/lib/parcelas-tabela";
import { brl, dt, uid } from "@/lib/format";
import { meta, rateioDaProposta } from "@/lib/helpers";

export const Route = createFileRoute("/_authenticated/contrato")({
  head: () => meta("Contrato de Corretagem", "Contrato de Prestação de Serviços de Corretagem Imobiliária com Rateio de Honorários em A4."),
  component: Contrato,
});

type Modalidade = "rateio" | "repasse";

const CSS = `
@page { size: A4 portrait; margin: 10mm 12mm; }
.ct { font-family: Arial, Helvetica, Inter, sans-serif; color: #0f172a; }
.ct .mono { font-family: "JetBrains Mono", "Roboto Mono", "Courier New", monospace; }
.ct h2 { margin-top: 18px; margin-bottom: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #0f172a; padding-bottom: 2px; }
.ct table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
.ct th { background-color: #0f172a; color: #ffffff; padding: 4px 6px; text-align: left; font-weight: 600; }
.ct td { border: 1px solid #cbd5e1; padding: 3px 6px; vertical-align: top; }
.ct tbody tr:nth-child(even) td { background: #f8fafc; }
.ct tfoot td { font-weight: 700; background: #f1f5f9; }
.ct .r { text-align: right; }
.ct .badge { display: inline-block; background: #eef2ff; color: #4338ca; border-radius: 9999px; padding: 0 8px; margin: 1px 2px 1px 0; font-size: 9px; font-weight: 600; }
.ct .info-card { border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 8px; margin-top: 6px; }
.ct .sig-box { border-top: 1px solid #0f172a; padding-top: 4px; text-align: center; font-size: 10px; margin-top: 36px; }
.ct table, .ct tr, .ct .info-card, .ct .sig-box { page-break-inside: avoid; break-inside: avoid; }
.ct p { text-align: justify; margin-top: 6px; }
@media print { .no-print { display: none !important; } .a4-sheet { padding: 0 !important; min-height: 0 !important; width: auto !important; } }
`;

const Tab = ({ head, rows, foot, right = [] }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode[]; right?: number[] }) => (
  <table><thead><tr>{head.map((h, i) => <th key={h} className={right.includes(i) ? "r" : ""}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={right.includes(j) ? "r" : ""}>{c}</td>)}</tr>)}</tbody>
    {foot && <tfoot><tr>{foot.map((c, j) => <td key={j} className={right.includes(j) ? "r" : ""}>{c}</td>)}</tr></tfoot>}</table>
);
const M = ({ children }: { children: ReactNode }) => <span className="mono">{children}</span>;

function linhasFluxo(parcelas: ParcelaIn[]) {
  return agruparParcelas(parcelas.filter((p) => p.valor > 0.004));
}
const fim = (l: LinhaParcelas) => vencimentoParcela(l.vencimento, l.tipo, l.quantidade - 1);

function Contrato() {
  const s = useStore((x) => x);
  const [id, setId] = useState(s.propostas[0]?.id ?? "");
  const [modalidade, setModalidade] = useState<Modalidade>("rateio");
  const p = s.propostas.find((x) => x.id === id) ?? s.propostas[0];
  if (!p) return <PageHeader title="Contrato" subtitle="Cadastre uma proposta primeiro." />;
  const { emp, res } = rateioDaProposta(s, p);
  const imob = s.membros.find((m) => m.funcao === "Imobiliária");
  const liquido = Math.round((p.vgv - res.totalComissao) * 100) / 100;
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const brutas = agruparParcelas(p.parcelas);
  const precoParc = res.eventos.map((e) => ({ ...e.parcela, valor: r2(e.liquidaFluxo) }));
  const comisParc = res.eventos.map((e) => ({ ...e.parcela, valor: r2(e.pool) }));
  const lPreco = linhasFluxo(precoParc), lComis = linhasFluxo(comisParc);

  // Participantes com comissão ativa, agrupando papéis por pessoa (exclui a PJ imobiliária)
  const benef = new Map<string, { m: Membro; cargos: Set<string>; valor: number }>();
  p.participantes.forEach((x) => {
    const m = s.membros.find((mm) => mm.id === x.membroId);
    if (!m || m.funcao === "Imobiliária" || !(res.tetos[x.membroId] > 0)) return;
    const b = benef.get(m.id) ?? { m, cargos: new Set<string>(), valor: 0 };
    b.cargos.add(m.funcao); b.valor = res.tetos[x.membroId] ?? 0; benef.set(m.id, b);
  });
  const lista = [...benef.values()];
  const totalBenef = r2(lista.reduce((a, b) => a + b.valor, 0));

  const dataExtenso = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const enviar = () => {
    const eid = "env-" + uid().slice(0, 4);
    setState((x) => ({ ...x, envelopes: [...x.envelopes, { id: eid, propostaId: p.id, status: "Pendente", link: `https://${x.config.sandbox ? "sandbox." : ""}app.assinafy.com.br/sign/${eid}`, enviadoEm: new Date().toISOString().slice(0, 10) }] }));
    toast.success(s.config.sandbox ? "Envelope criado na Assinafy (sandbox)" : "Contrato enviado para assinatura");
  };
  const tabelaFluxo = (ls: LinhaParcelas[]) => <Tab right={[0, 2, 5]} head={["Qtd", "Tipo", "Valor da Parcela", "Vencimento", "Vencimento Final", "Valor Total da Parcela"]}
    rows={ls.map((l) => [<M>{l.quantidade}</M>, l.tipo, <M>{brl(l.valor)}</M>, <M>{dt(l.vencimento)}</M>, <M>{dt(fim(l))}</M>, <M>{brl(totalLinha(l))}</M>])}
    foot={["", "Total", "", "", "", <M>{brl(ls.reduce((a, l) => a + totalLinha(l), 0))}</M>]} />;

  return (
    <div>
      <style>{CSS}</style>
      <PageHeader title="Contrato de Corretagem Imobiliária" subtitle="Pré-visualização em A4 retrato"
        actions={<div className="no-print flex flex-wrap gap-2">
          <PropostaPicker value={p.id} onChange={setId} />
          <Select aria-label="Modalidade" value={modalidade} onChange={(e) => setModalidade(e.target.value as Modalidade)}>
            <option value="rateio">Rateio ordinário de honorários</option><option value="repasse">Repasse via construtora / NF</option>
          </Select>
          <Btn variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir / Salvar PDF</Btn>
          <Btn variant="outline" onClick={() => { toast.info("Escolha \"Salvar como PDF\" no destino da impressão."); window.print(); }}><FileDown className="h-4 w-4" />Baixar PDF Oficial</Btn>
          <Btn onClick={enviar}><Send className="h-4 w-4" />Enviar para Assinatura Eletrônica</Btn>
        </div>} />
      <div className="overflow-x-auto">
        <article className="ct a4-sheet print-sheet mx-auto border bg-card text-[11px] leading-relaxed shadow-lg">
          <header className="flex items-center justify-between border-b-2 pb-2" style={{ borderColor: "#0f172a" }}>
            <div className="text-lg font-black tracking-tight">R&amp;J <span className="font-normal">Imóveis</span></div>
            <div className="mono text-[9px]">{imob?.creci}</div>
          </header>
          <h1 className="mt-3 text-center text-[14px] font-bold uppercase">Contrato de Prestação de Serviços de Corretagem Imobiliária</h1>
          <p className="!mt-0 !text-center text-[11px]">{modalidade === "rateio" ? "Intermediação Imobiliária com Rateio de Honorários" : "Intermediação Imobiliária com Repasse Construtora / NF"}</p>

          <h2>1 - Partes qualificadas</h2>
          {p.compradores.map((c, i) => (
            <div key={i} className="info-card"><b>CONTRATANTE {i + 1}.º TITULAR:</b> {c.nome}, {c.nacionalidade || "brasileiro(a)"}, {c.estadoCivil || "estado civil não informado"}{c.conjuge ? ` (cônjuge: ${c.conjuge})` : ""}, {c.profissao || "profissão não informada"}, CPF <M>{c.cpf}</M>, RG <M>{c.rg}</M>, residente em {c.endereco}; telefone <M>{c.telefone || "—"}</M>; e-mail {c.email || "—"}.</div>
          ))}
          <div className="info-card"><b>CONTRATADA (INTERMEDIADORA):</b> {imob?.nome ?? "—"}, CNPJ <M>{imob?.doc ?? "—"}</M>, CRECI Jurídico <M>{imob?.creci ?? "—"}</M>, e-mail {imob?.email || "—"}.</div>

          <h2>2 - Empreendimento e imóvel</h2>
          <Tab head={["Empreendimento", "Unidade", "Bloco/Torre", "Endereço"]} rows={[[emp?.nome ?? "—", <M>{p.unidade}</M>, p.torre, emp?.endereco ?? "—"]]} />

          <h2>3 - Proposta comercial (resumo financeiro)</h2>
          <Tab right={[1]} head={["Descrição", "Valor"]} rows={[
            ["VALOR TOTAL DA PROPOSTA (VGV)", <M>{brl(p.vgv)}</M>],
            ["PREÇO TOTAL DO IMÓVEL (VGV - COMISSÕES)", <M>{brl(liquido)}</M>],
            ["VALOR TOTAL DAS COMISSÕES", <M>{brl(res.totalComissao)}</M>],
          ]} />

          <h2>4 - Condições de pagamento</h2>
          <div className="text-[10px] font-bold uppercase">Tabela 1 - Condição de Pagamento da Proposta (fluxo bruto do cliente)</div>
          <Tab right={[0, 2, 4, 5]} head={["#", "Tipo de Parcela", "Qtd", "1.º Vencimento", "Valor Unitário", "Total da Série"]}
            rows={brutas.map((l, i) => [<M>{i + 1}</M>, l.tipo, <M>{l.quantidade}</M>, <M>{dt(l.vencimento)}</M>, <M>{brl(l.valor)}</M>, <M>{brl(totalLinha(l))}</M>])}
            foot={["", "Total", "", "", "", <M>{brl(brutas.reduce((a, l) => a + totalLinha(l), 0))}</M>]} />
          <div className="mt-3 text-[10px] font-bold uppercase">Tabela 2 - Condição de Pagamento do Preço (líquido da construtora)</div>
          {tabelaFluxo(lPreco)}
          <div className="mt-3 text-[10px] font-bold uppercase">Tabela 3 - Condição de Pagamento das Comissões</div>
          {tabelaFluxo(lComis)}

          <h2>5 - Equipe de vendas e credenciais dos participantes</h2>
          <div className="text-[10px] font-bold uppercase">Tabela - Credenciais dos participantes na venda</div>
          <Tab head={["Nome", "Apelido", "CPF / CNPJ", "CRECI", "Cargo na Operação"]}
            rows={lista.map((b) => [b.m.nome, b.m.apelido, <M>{b.m.doc}</M>, <M>{b.m.creci}</M>, <>{[...b.cargos].map((c) => <span key={c} className="badge">{c}</span>)}</>])} />

          <h2>6 - Cláusulas contratuais</h2>
          <p><b>Cláusula 1.ª — Do objeto e da natureza dos profissionais.</b> O presente instrumento tem por objeto a intermediação da aquisição do imóvel descrito na Seção 2, realizada pela CONTRATADA e pelos corretores associados relacionados na Seção 5, que atuam de forma autônoma, sem vínculo empregatício, com partilha de honorários nos termos do art. 6.º, §§ 2.º e 3.º, da Lei n.º 6.530/1978 (redação da Lei n.º 13.097/2015) e do art. 728 do Código Civil.</p>
          <p><b>Cláusula 2.ª — Da ciência de preço e honorários.</b> O(s) CONTRATANTE(S) declara(m) ciência de que, do valor total da proposta (<M>{brl(p.vgv)}</M>), a quantia de <M>{brl(res.totalComissao)}</M> reverte integralmente à remuneração da intermediação, sendo devida com a celebração da proposta, e que o preço do imóvel destinado ao incorporador é de <M>{brl(liquido)}</M>. Parcelas de Financiamento Bancário, FGTS e Subsídio não sofrem dedução de honorários.</p>
          <p><b>Cláusula 3.ª — Da forma de pagamento e encargos moratórios.</b> {modalidade === "rateio"
            ? "Os honorários serão pagos diretamente pelo(s) CONTRATANTE(S) aos profissionais beneficiários, conforme Tabela 3 e Anexo I, mediante boleto bancário ou Pix."
            : `Os valores serão pagos pelo(s) CONTRATANTE(S) à ${emp?.construtora || "construtora/incorporadora"}, que repassará os honorários à CONTRATADA; esta emitirá nota fiscal com as retenções tributárias cabíveis e efetuará o split aos corretores, conforme Tabela 3 e Anexo I.`} Em caso de mora, incidirão juros moratórios de 1% (um por cento) ao mês, multa de 2% (dois por cento) e correção monetária pelo IGP-M/FGV.</p>
          <p><b>Cláusula 4.ª — Do título executivo extrajudicial.</b> As partes reconhecem que o presente instrumento, assinado por duas testemunhas, constitui título executivo extrajudicial, representando dívida líquida, certa e exigível, nos termos do art. 784, inciso III, do Código de Processo Civil.</p>
          <p><b>Cláusula 5.ª — Do direito de reflexão e da irrevogabilidade.</b> Este contrato é celebrado em caráter irrevogável e irretratável, ressalvado o direito de arrependimento no prazo de 7 (sete) dias previsto no art. 49 do Código de Defesa do Consumidor, quando aplicável à contratação realizada fora do estabelecimento comercial.</p>
          <p><b>Cláusula 6.ª — Do foro.</b> Fica eleito o foro da comarca do local do imóvel para dirimir quaisquer controvérsias oriundas deste instrumento, com renúncia a qualquer outro, por mais privilegiado que seja.</p>

          <h2>7 - Das comissões por beneficiário (Anexo I de honorários)</h2>
          <Tab right={[3]} head={["Apelido", "Nome", "Cargo", "Valor (R$)"]}
            rows={lista.map((b) => [b.m.apelido, b.m.nome, [...b.cargos].join(", "), <M>{brl(b.valor)}</M>])}
            foot={["", "Total (100%)", "", <M>{brl(totalBenef)}</M>]} />

          <h2>8 - Assinaturas e fechamento</h2>
          <p>_______________________ - ___, {dataExtenso}.</p>
          <div className="grid grid-cols-2 gap-x-10">
            {p.compradores.map((c, i) => <div key={i} className="sig-box">{c.nome}<br /><M>CPF {c.cpf}</M><br />CONTRATANTE</div>)}
            <div className="sig-box">{imob?.nome}<br /><M>CNPJ {imob?.doc} · CRECI {imob?.creci}</M><br />IMOBILIÁRIA INTERMEDIADORA</div>
            {lista.map((b) => <div key={b.m.id} className="sig-box">{b.m.nome}<br /><M>CRECI {b.m.creci}</M><br />CORRETOR ASSOCIADO</div>)}
            {[1, 2].map((n) => <div key={n} className="sig-box">TESTEMUNHA {n}<br />Nome: ______________________<br />CPF: _______________________</div>)}
          </div>
        </article>
      </div>
    </div>
  );
}
