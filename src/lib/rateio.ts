export const TIPOS_PARCELA = ["Sinal/Ato", "Mensal", "Semestral", "Chaves", "Financiamento Bancário", "FGTS", "Subsídio"] as const;
export type TipoParcela = (typeof TIPOS_PARCELA)[number];
export const PROTEGIDAS: TipoParcela[] = ["Financiamento Bancário", "FGTS", "Subsídio"];

export type Retencao = Record<TipoParcela, number>;
export const RETENCAO_PADRAO: Retencao = {
  "Sinal/Ato": 100, Mensal: 50, Semestral: 50, Chaves: 30, "Financiamento Bancário": 0, FGTS: 0, Subsídio: 0,
};

export interface ParcelaIn { id: string; tipo: TipoParcela; valor: number; vencimento: string }
export interface ParticipanteIn { id: string; nome: string; pct: number }

export interface EventoRateio {
  parcela: ParcelaIn; pool: number; pagamentos: Record<string, number>; acumuladoTotal: number; liquidaFluxo: number;
}
export interface ResultadoRateio {
  totalComissao: number; tetos: Record<string, number>; pagos: Record<string, number>;
  eventos: EventoRateio[]; quitacao: Record<string, string | null>; liberacao: string | null; saldoPendente: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularRateio(vgv: number, participantes: ParticipanteIn[], parcelas: ParcelaIn[], retencao: Retencao): ResultadoRateio {
  const tetos: Record<string, number> = {};
  const pagos: Record<string, number> = {};
  const quitacao: Record<string, string | null> = {};
  participantes.forEach((p) => { tetos[p.id] = r2((vgv * p.pct) / 100); pagos[p.id] = 0; quitacao[p.id] = null; });
  const totalComissao = r2(Object.values(tetos).reduce((a, b) => a + b, 0));
  let acumulado = 0;
  let liberacao: string | null = null;
  const eventos: EventoRateio[] = [];
  const ordenadas = [...parcelas].sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  for (const parcela of ordenadas) {
    const protegida = PROTEGIDAS.includes(parcela.tipo);
    const ret = protegida ? 0 : (retencao[parcela.tipo] ?? 0) / 100;
    let pool = r2(Math.min(parcela.valor * ret, totalComissao - acumulado));
    if (pool < 0) pool = 0;
    const poolInicial = pool;
    const pagamentos: Record<string, number> = {};
    // Cascata: distribui proporcionalmente entre ativos; excedente de quem atinge o teto volta ao pool
    let guard = 0;
    while (pool > 0.004 && guard++ < 50) {
      const ativos = participantes.filter((p) => tetos[p.id]! - pagos[p.id]! > 0.004);
      if (!ativos.length) break;
      const somaPct = ativos.reduce((a, p) => a + p.pct, 0);
      let distribuido = 0;
      for (const p of ativos) {
        const cota = (pool * p.pct) / somaPct;
        const paga = Math.min(cota, tetos[p.id]! - pagos[p.id]!);
        pagos[p.id]! += paga; pagamentos[p.id] = (pagamentos[p.id] ?? 0) + paga; distribuido += paga;
        if (tetos[p.id]! - pagos[p.id]! <= 0.004 && !quitacao[p.id]) quitacao[p.id] = parcela.vencimento;
      }
      pool -= distribuido;
    }
    Object.keys(pagamentos).forEach((k) => (pagamentos[k] = r2(pagamentos[k]!)));
    acumulado = r2(acumulado + poolInicial);
    if (!liberacao && totalComissao > 0 && acumulado >= totalComissao - 0.01) liberacao = parcela.vencimento;
    eventos.push({ parcela, pool: poolInicial, pagamentos, acumuladoTotal: acumulado, liquidaFluxo: r2(parcela.valor - poolInicial) });
  }
  Object.keys(pagos).forEach((k) => (pagos[k] = r2(pagos[k]!)));
  return { totalComissao, tetos, pagos, eventos, quitacao, liberacao, saldoPendente: r2(totalComissao - acumulado) };
}
