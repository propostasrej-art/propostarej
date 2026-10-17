import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Btn, Card, Input, Mono, Select, Td, Th } from "./kit";
import { type ParcelaIn, type TipoParcela } from "@/lib/rateio";
import { useStore } from "@/lib/store";
import { nomesTiposParcela } from "@/lib/tipos-parcela";
import { agruparParcelas, expandirLinhas, totalLinha, type LinhaParcelas } from "@/lib/parcelas-tabela";
import { brl, moedaEdicao, parseMoedaBR, uid } from "@/lib/format";

export function ParcelasTable({ parcelas, onChange, revisar, indicador, destaque }: {
  parcelas: ParcelaIn[]; onChange: (parcelas: ParcelaIn[]) => void;
  revisar: (id: string) => void; indicador: (id: string) => ReactNode; destaque: (ids: string[]) => string;
}) {
  const [linhas, setLinhas] = useState(() => agruparParcelas(parcelas));
  const [editando, setEditando] = useState<{ id: string; txt: string } | null>(null);
  const cadastrados = useStore((s) => s.tiposParcela);
  const tipos = nomesTiposParcela(cadastrados, parcelas.map((p) => p.tipo));
  const emitidas = useRef(parcelas);
  useEffect(() => {
    if (parcelas !== emitidas.current) { setLinhas(agruparParcelas(parcelas)); emitidas.current = parcelas; }
  }, [parcelas]);
  function atualizar(proximas: LinhaParcelas[]) {
    const novas = expandirLinhas(proximas, uid);
    let inicio = 0;
    setLinhas(proximas.map((linha) => {
      const ids = novas.slice(inicio, inicio + linha.quantidade).map((p) => p.id);
      inicio += linha.quantidade;
      return { ...linha, ids };
    }));
    emitidas.current = novas;
    onChange(novas);
  }
  return <Card title="Tabela de parcelas" action={<Btn variant="ghost" onClick={() => {
    const id = uid();
    atualizar([...linhas, { id, ids: [id], quantidade: 1, tipo: "Mensal", valor: 0, vencimento: new Date().toISOString().slice(0, 10) }]);
  }}><Plus className="h-4 w-4" />Adicionar parcela</Btn>}>
    <div className="overflow-x-auto"><table className="w-full min-w-[780px]"><thead><tr>
      <Th>Quantidade</Th><Th>Tipo de parcela</Th><Th className="text-right">Valor Unitário</Th><Th>1.º vencimento</Th><Th className="text-right">Valor Total da Parcela</Th><Th />
    </tr></thead><tbody>
      {linhas.map((linha, indice) => {
        const alterar = (patch: Partial<LinhaParcelas>) => {
          linha.ids.forEach(revisar);
          atualizar(linhas.map((l, i) => i === indice ? { ...l, ...patch } : l));
        };
        return <tr key={linha.id} data-k={`p:${linha.ids[0]}`} className={destaque(linha.ids)}>
          <Td><Input aria-label={`Quantidade ${indice + 1}`} type="number" min="1" step="1" className="w-24 font-mono" value={linha.quantidade} onChange={(e) => alterar({ quantidade: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })} /></Td>
          <Td><Select aria-label={`Tipo de parcela ${indice + 1}`} className="min-w-44" value={linha.tipo} onChange={(e) => alterar({ tipo: e.target.value as TipoParcela })}>{tipos.map((tipo) => <option key={tipo}>{tipo}</option>)}</Select></Td>
          <Td><Input aria-label={`Valor Unitário ${indice + 1}`} inputMode="decimal" className="min-w-36 font-mono text-right" value={editando?.id === linha.id ? editando.txt : brl(linha.valor)} onFocus={() => setEditando({ id: linha.id, txt: moedaEdicao(linha.valor) })} onBlur={() => setEditando(null)} onChange={(e) => { const txt = e.target.value; setEditando({ id: linha.id, txt }); alterar({ valor: parseMoedaBR(txt) }); }} /></Td>
          <Td><Input aria-label={`1.º vencimento ${indice + 1}`} type="date" className="min-w-36 font-mono" value={linha.vencimento} onChange={(e) => alterar({ vencimento: e.target.value })} /></Td>
          <Td className="text-right"><Mono className="whitespace-nowrap font-semibold text-success">{brl(totalLinha(linha))}</Mono></Td>
          <Td><div className="flex items-center gap-1">{linha.ids.map((id) => <span key={id} data-k={`p:${id}`}>{indicador(id)}</span>)}<Btn variant="danger" aria-label={`Excluir parcela ${indice + 1}`} title="Excluir parcela" onClick={() => { linha.ids.forEach(revisar); atualizar(linhas.filter((_, i) => i !== indice)); }}><Trash2 className="h-4 w-4" /></Btn></div></Td>
        </tr>;
      })}
      {!linhas.length && <tr><td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Nenhuma parcela cadastrada.</td></tr>}
    </tbody><tfoot><tr><td colSpan={4} className="px-3 pt-4 text-right text-sm font-semibold">Total</td><td className="px-3 pt-4 text-right"><Mono className="whitespace-nowrap font-semibold text-success">{brl(linhas.reduce((total, linha) => total + totalLinha(linha), 0))}</Mono></td><td /></tr></tfoot></table></div>
  </Card>;
}