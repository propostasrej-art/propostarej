import { ajustarAliquotas, calcularRateio, RETENCAO_PADRAO, type Tier } from "./rateio";
import type { State, Proposta, Funcao } from "./store";

/** Camada de absorção de sobras por cargo (Manual de Rateio, Etapa 5). */
export const tierDaFuncao = (f?: Funcao): Tier =>
  f === "Jurídico" || f === "Imobiliária" || f === "Diretor Comercial" ? 1 : f === "Gerente" ? 2 : 3;

export function rateioDaProposta(s: State, p: Proposta) {
  const emp = s.empreendimentos.find((e) => e.id === p.empreendimentoId);
  const brutos = p.participantes.map((x) => {
    const m = s.membros.find((mm) => mm.id === x.membroId);
    return {
      id: x.membroId, nome: m?.nome ?? "?", pct: x.pct, funcao: m?.funcao, cargo: (x.cargo?.trim() || m?.funcao) as string | undefined, ocultar: !!x.ocultar && m?.funcao !== "Imobiliária",
      tier: tierDaFuncao(m?.funcao), atoFull: x.atoFull ?? m?.funcao === "Jurídico", intermediadora: m?.funcao === "Imobiliária",
    };
  });
  // Prêmio (% do VGV) soma-se à comissão já ajustada de cada participante.
  const parts = ajustarAliquotas(brutos, { pctPorCargo: p.pctPorCargo, taxa: p.taxaComissao })
    .map((x, i) => ({ ...x, pct: x.pct + (Number(p.participantes[i]?.premio) || 0) }));
  return { emp, parts, res: calcularRateio(p.vgv, parts, p.parcelas, emp?.retencao ?? RETENCAO_PADRAO, { modalidade: p.modalidade }) };
}
export const comissaoPct = (p: Proposta) => (p.taxaComissao && p.taxaComissao > 0 && p.participantes.length ? p.taxaComissao : p.participantes.reduce((a, b) => a + b.pct, 0));
export const somaParcelas = (p: Proposta) => p.parcelas.reduce((a, b) => a + (b.valor || 0), 0);
export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} · Analista R&J` }, { name: "description", content: description },
    { property: "og:title", content: `${title} · Analista R&J` }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ],
});
