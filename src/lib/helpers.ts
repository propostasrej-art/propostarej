import { calcularRateio, RETENCAO_PADRAO } from "./rateio";
import type { State, Proposta } from "./store";

export function rateioDaProposta(s: State, p: Proposta) {
  const emp = s.empreendimentos.find((e) => e.id === p.empreendimentoId);
  const parts = p.participantes.map((x) => {
    const m = s.membros.find((mm) => mm.id === x.membroId);
    return { id: x.membroId, nome: m?.nome ?? "?", pct: x.pct };
  });
  return { emp, parts, res: calcularRateio(p.vgv, parts, p.parcelas, emp?.retencao ?? RETENCAO_PADRAO) };
}
export const comissaoPct = (p: Proposta) => p.participantes.reduce((a, b) => a + b.pct, 0);
export const somaParcelas = (p: Proposta) => p.parcelas.reduce((a, b) => a + (b.valor || 0), 0);
export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} · Analista R&J` }, { name: "description", content: description },
    { property: "og:title", content: `${title} · Analista R&J` }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ],
});
