import { addMonths, format, parseISO } from "date-fns";
import type { ParcelaIn, TipoParcela } from "./rateio";

export type LinhaParcelas = { id: string; ids: string[]; quantidade: number; tipo: TipoParcela; valor: number; vencimento: string };
const intervalo = (tipo: TipoParcela) => tipo === "Semestral" ? 6 : 1;
export function vencimentoParcela(primeiro: string, tipo: TipoParcela, indice: number) {
  if (!primeiro) return "";
  return format(addMonths(parseISO(primeiro), intervalo(tipo) * indice), "yyyy-MM-dd");
}
export const totalLinha = (linha: Pick<LinhaParcelas, "quantidade" | "valor">) => Math.round(linha.quantidade * linha.valor * 100) / 100;

export function agruparParcelas(parcelas: ParcelaIn[]): LinhaParcelas[] {
  const linhas: LinhaParcelas[] = [];
  for (const parcela of parcelas) {
    const linha = linhas.find((l) => (l.tipo === "Mensal" || l.tipo === "Semestral") && l.tipo === parcela.tipo && l.valor === parcela.valor && l.vencimento && vencimentoParcela(l.vencimento, l.tipo, l.quantidade) === parcela.vencimento);
    if (linha) { linha.ids.push(parcela.id); linha.quantidade += 1; }
    else linhas.push({ ...parcela, ids: [parcela.id], quantidade: 1 });
  }
  return linhas;
}

export function expandirLinhas(linhas: LinhaParcelas[], novoId: () => string): ParcelaIn[] {
  return linhas.flatMap((linha) => Array.from({ length: linha.quantidade }, (_, i) => ({
    id: linha.ids[i] ?? novoId(), tipo: linha.tipo, valor: linha.valor,
    vencimento: vencimentoParcela(linha.vencimento, linha.tipo, i),
  })));
}