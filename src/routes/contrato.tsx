import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Printer, FileDown } from "lucide-react";
import { Btn, PageHeader } from "@/components/kit";
import { PropostaPicker } from "@/components/PropostaPicker";
import { useStore } from "@/lib/store";
import { PROTEGIDAS } from "@/lib/rateio";
import { brl, dt, pct } from "@/lib/format";
import { comissaoPct, meta, rateioDaProposta } from "@/lib/helpers";

export const Route = createFileRoute("/contrato")({
  head: () => meta("Contrato e Minutas", "Contrato de Prestação de Serviços de Corretagem Imobiliária em A4."),
  component: Contrato,
});

const T = ({ title, head, rows }: { title: string; head: string[]; rows: ReactNode[][] }) => (
  <div className="mt-5 break-inside-avoid">
    <div className="mb-1 text-xs font-bold uppercase">{title}</div>
    <table className="w-full border-collapse text-[11px]"><thead><tr>{head.map((h) => <th key={h} className="border bg-muted px-2 py-1 text-left">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border px-2 py-1 font-mono">{c}</td>)}</tr>)}</tbody></table>
  </div>
);

function Contrato() {
  const s = useStore((x) => x);
  const [id, setId] = useState(s.propostas[0]?.id ?? "");
  const p = s.propostas.find((x) => x.id === id) ?? s.propostas[0];
  if (!p) return <PageHeader title="Contrato" subtitle="Cadastre uma proposta primeiro." />;
  const { emp, parts, res } = rateioDaProposta(s, p);
  const c = p.compradores[0];
  const imob = s.membros.find((m) => m.funcao === "Imobiliária");
  const liquido = p.vgv - res.totalComissao;
  const membros = p.participantes.map((x) => s.membros.find((m) => m.id === x.membroId)!).filter(Boolean);
  return (
    <div>
      <style>{`@page { size: A4 portrait; margin: 0; }`}</style>
      <PageHeader title="Gerador de Contrato e Minutas Oficiais" subtitle="Pré-visualização em A4"
        actions={<><PropostaPicker value={p.id} onChange={setId} /><Btn variant="outline" onClick={() => window.print()}><FileDown className="h-4 w-4" />Baixar PDF</Btn><Btn onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir</Btn></>} />
      <div className="overflow-x-auto">
        <article className="a4-sheet print-sheet mx-auto border bg-card text-[12px] leading-relaxed text-card-foreground shadow-lg">
          <h1 className="text-center text-base font-bold uppercase">Contrato de Prestação de Serviços de Corretagem Imobiliária</h1>
          <p className="mt-1 text-center text-[11px]">Lei nº 6.530/78 e arts. 722 a 729 do Código Civil (art. 728)</p>
          <p className="mt-4 text-justify"><b>CONTRATANTE(S):</b> {p.compradores.map((x) => `${x.nome}, CPF ${x.cpf}, RG ${x.rg}, residente em ${x.endereco}${x.conjuge ? `, casado(a) com ${x.conjuge}` : ""}`).join("; ")}.</p>
          <p className="mt-2 text-justify"><b>CONTRATADA:</b> {imob?.nome}, inscrita no CNPJ <span className="font-mono">{imob?.doc}</span>, {imob?.creci}, doravante denominada IMOBILIÁRIA.</p>
          <p className="mt-2 text-justify"><b>OBJETO:</b> intermediação da aquisição da unidade <b>{p.unidade}</b>, torre <b>{p.torre}</b>, vaga <b>{p.vaga}</b>, do empreendimento <b>{emp?.nome}</b>, situado em {emp?.endereco}, incorporado por {emp?.construtora}, pelo preço total de <span className="font-mono font-bold">{brl(p.vgv)}</span>.</p>
          <p className="mt-2 text-justify"><b>CLÁUSULA DE REMUNERAÇÃO:</b> pelos serviços de corretagem, é devida a comissão de <span className="font-mono">{pct(comissaoPct(p))}</span> sobre o valor da venda, totalizando <span className="font-mono">{brl(res.totalComissao)}</span>, rateada entre os participantes conforme Tabelas 3 e 4, sendo devida ainda que o negócio não se efetive em virtude de arrependimento das partes (art. 725 do CC). Parcelas de Financiamento Bancário, FGTS e Subsídio não sofrem dedução.</p>
          <T title="Tabela 1 — Condição de Pagamento da Proposta" head={["Tipo", "Vencimento", "Valor"]} rows={p.parcelas.map((x) => [x.tipo, dt(x.vencimento), brl(x.valor)])} />
          <T title="Tabela 2 — Preço Líquido do Imóvel" head={["Descrição", "Valor"]} rows={[["Preço total (VGV)", brl(p.vgv)], ["(–) Comissão de corretagem", brl(res.totalComissao)], ["Preço líquido ao incorporador", brl(liquido)]]} />
          <T title="Tabela 3 — Comissões" head={["Participante", "%", "Valor"]} rows={[...parts.map((x) => [x.nome, pct(x.pct), brl(res.tetos[x.id])] as ReactNode[]), ["Total", pct(comissaoPct(p)), brl(res.totalComissao)] as ReactNode[]]} />
          <T title="Tabela 4 — Cronograma de Rateio" head={["Vencimento", "Parcela", "Comissão", ...parts.map((x) => x.nome.split(" ")[0] ?? x.nome)]}
            rows={res.eventos.filter((e) => e.pool > 0 || !PROTEGIDAS.includes(e.parcela.tipo)).map((e) => [dt(e.parcela.vencimento), e.parcela.tipo, brl(e.pool), ...parts.map((x) => (e.pagamentos[x.id] ? brl(e.pagamentos[x.id]) : "—"))])} />
          <T title="Tabela 5 — Credenciais dos Participantes na Venda" head={["Nome", "Apelido", "CPF/CNPJ", "CRECI", "Cargo"]} rows={membros.map((m) => [m.nome, m.apelido, m.doc, m.creci, m.funcao])} />
          <p className="mt-5 text-justify">Fica eleito o foro da comarca do imóvel para dirimir quaisquer controvérsias oriundas deste instrumento.</p>
          <p className="mt-4">Local e data: _______________________, {new Date().toLocaleDateString("pt-BR")}.</p>
          <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[11px]">
            <div className="border-t pt-1">{c?.nome}<br />CONTRATANTE</div><div className="border-t pt-1">{imob?.nome}<br />CONTRATADA</div>
            <div className="border-t pt-1">Testemunha 1</div><div className="border-t pt-1">Testemunha 2</div>
          </div>
        </article>
      </div>
    </div>
  );
}
