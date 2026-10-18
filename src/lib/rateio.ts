export const TIPOS_PARCELA = ["Sinal/Ato", "Mensal", "Semestral", "Chaves", "Financiamento Bancário", "FGTS", "Subsídio"] as const;
export type TipoParcela = string;
/** Parcelas que nunca deduzem comissão (Manual de Rateio, Etapa 2). */
export const PROTEGIDAS: TipoParcela[] = ["Financiamento Bancário", "FGTS", "Subsídio"];
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Protegida por nome fixo ou por padrão: incorporador, subsídio habitacional, prêmio, bonificação. */
export function ehProtegida(tipo: TipoParcela) {
  if (PROTEGIDAS.includes(tipo)) return true;
  const t = norm(tipo);
  return /incorporador|subsidio|premio|bonifica|adimplencia|adimplemento/.test(t);
}

export type Retencao = Record<TipoParcela, number>;
export const RETENCAO_PADRAO: Retencao = {
  "Sinal/Ato": 100, Mensal: 50, Semestral: 50, Chaves: 30, "Financiamento Bancário": 0, FGTS: 0, Subsídio: 0,
};

export type Modalidade = "pagadoria" | "pagadoria_incorporador" | "repasse";
export const MODALIDADES: { id: Modalidade; nome: string }[] = [
  { id: "pagadoria", nome: "Pagadoria" },
  { id: "pagadoria_incorporador", nome: "Pagadoria Incorporador" },
  { id: "repasse", nome: "NF/Repasse (quitação única)" },
];
export type Tier = 1 | 2 | 3;
export const NOME_TIER: Record<Tier, string> = { 1: "Tier 1 · Apoio e Estrutura", 2: "Tier 2 · Liderança Operacional", 3: "Tier 3 · Operacional de Vendas" };

export interface ParcelaIn { id: string; tipo: TipoParcela; valor: number; vencimento: string }
export interface ParticipanteIn {
  id: string; nome: string; pct: number;
  /** Camada de absorção de sobras (padrão 3). */
  tier?: Tier;
  /** Exceção ATO_FULL: liquidado integralmente nos primeiros recebimentos. */
  atoFull?: boolean;
  /** Recebe os centavos de equalização dos tetos (Imobiliária Intermediadora). */
  intermediadora?: boolean;
}
export interface OpcoesRateio { modalidade?: Modalidade }

export interface Transbordo { tier: Tier; valor: number }
export interface EventoRateio {
  parcela: ParcelaIn; pool: number; pagamentos: Record<string, number>; acumuladoTotal: number; liquidaFluxo: number;
  /** Sobras roteadas pela cascata de tiers neste evento. */
  transbordo: Transbordo[];
  /** Participantes que atingiram o teto neste evento. */
  capados: string[];
}
export interface ResultadoRateio {
  totalComissao: number; tetos: Record<string, number>; pagos: Record<string, number>;
  eventos: EventoRateio[]; quitacao: Record<string, string | null>; liberacao: string | null; saldoPendente: number;
  modalidade: Modalidade;
}

const c = (n: number) => Math.round(n * 100);
const r = (cents: number) => cents / 100;

/** Divide `total` centavos proporcionalmente aos pesos, limitado a `limites`, pelo maior resto. */
function partilhar(total: number, ids: string[], pesos: Record<string, number>, limites: Record<string, number>) {
  const out: Record<string, number> = {};
  let resto = total;
  let ativos = ids.filter((id) => limites[id]! > 0);
  while (resto > 0 && ativos.length) {
    const soma = ativos.reduce((a, id) => a + (pesos[id] || 0), 0) || ativos.length;
    const brutos = ativos.map((id) => ({ id, v: (resto * (pesos[id] || (soma === ativos.length ? 1 : 0))) / soma }));
    let distribuido = 0;
    const fracs: { id: string; f: number }[] = [];
    for (const { id, v } of brutos) {
      const disp = limites[id]! - (out[id] ?? 0);
      const inteiro = Math.min(Math.floor(v), disp);
      out[id] = (out[id] ?? 0) + inteiro; distribuido += inteiro;
      if (inteiro < disp) fracs.push({ id, f: v - Math.floor(v) });
    }
    let sobra = resto - distribuido;
    // centavos residuais pelo maior resto
    fracs.sort((a, b) => b.f - a.f);
    for (const { id } of fracs) {
      if (sobra <= 0) break;
      if (limites[id]! - out[id]! > 0) { out[id]! += 1; sobra--; distribuido++; }
    }
    resto -= distribuido;
    const novos = ativos.filter((id) => limites[id]! - (out[id] ?? 0) > 0);
    if (novos.length === ativos.length && distribuido === 0) break;
    ativos = novos;
  }
  return { out, resto };
}

export function calcularRateio(vgv: number, participantes: ParticipanteIn[], parcelas: ParcelaIn[], retencao: Retencao, opcoes: OpcoesRateio = {}): ResultadoRateio {
  const modalidade = opcoes.modalidade ?? "pagadoria";
  // Etapa 1: tetos com equalização de centavos na intermediadora (ou último participante)
  const tetosC: Record<string, number> = {};
  const pagosC: Record<string, number> = {};
  const quitacao: Record<string, string | null> = {};
  const pesos: Record<string, number> = {};
  participantes.forEach((p) => { tetosC[p.id] = c((vgv * p.pct) / 100); pagosC[p.id] = 0; quitacao[p.id] = null; pesos[p.id] = p.pct; });
  const somaPct = participantes.reduce((a, p) => a + p.pct, 0);
  const totalC = c((vgv * somaPct) / 100);
  const ajuste = participantes.find((p) => p.intermediadora) ?? participantes[participantes.length - 1];
  if (ajuste) tetosC[ajuste.id]! += totalC - Object.values(tetosC).reduce((a, b) => a + b, 0);

  const ordenadas = [...parcelas].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const idxRepasse = modalidade === "repasse"
    ? Math.max(0, ordenadas.findIndex((p) => p.tipo === "Financiamento Bancário"))
    : -1;
  const saldo = (id: string) => tetosC[id]! - pagosC[id]!;
  let acumulado = 0;
  let liberacao: string | null = null;
  const eventos: EventoRateio[] = [];

  ordenadas.forEach((parcela, i) => {
    // Etapa 2: filtro e dedução da parcela, limitada ao passivo remanescente
    let ret: number;
    if (modalidade === "repasse") ret = i === idxRepasse ? 1 : 0;
    else ret = ehProtegida(parcela.tipo) ? 0 : (retencao[parcela.tipo] ?? 0) / 100;
    const poolC = Math.max(0, Math.min(c(parcela.valor * ret), totalC - acumulado));
    let massa = poolC;
    const pagC: Record<string, number> = {};
    const pagar = (id: string, v: number) => { if (v > 0) { pagosC[id]! += v; pagC[id] = (pagC[id] ?? 0) + v; } };

    // Etapa 3: exceções ATO_FULL
    for (const p of participantes.filter((x) => x.atoFull)) {
      const v = Math.min(massa, saldo(p.id)); pagar(p.id, v); massa -= v;
    }
    // Etapa 4: distribuição ordinária proporcional com capping imediato (uma passada)
    const ordinarios = participantes.filter((x) => !x.atoFull && saldo(x.id) > 0).map((x) => x.id);
    const somaOrd = ordinarios.reduce((a, id) => a + pesos[id]!, 0);
    if (massa > 0 && somaOrd > 0) {
      const brutos = ordinarios.map((id) => ({ id, v: (massa * pesos[id]!) / somaOrd }));
      let usado = 0;
      const fr: { id: string; f: number }[] = [];
      for (const { id, v } of brutos) { const x = Math.min(Math.floor(v), saldo(id)); pagar(id, x); usado += x; if (saldo(id) > 0) fr.push({ id, f: v - Math.floor(v) }); }
      let cent = Math.min(massa - usado, brutos.reduce((a, b) => a + b.v, 0) - usado);
      cent = Math.round(cent);
      fr.sort((a, b) => b.f - a.f);
      for (const { id } of fr) { if (cent <= 0) break; if (saldo(id) > 0) { pagar(id, 1); usado++; cent--; } }
      massa -= usado;
    }
    // Etapa 5: sobras roteadas Tier 1 → Tier 2 → Tier 3
    const transbordo: Transbordo[] = [];
    for (const tier of [1, 2, 3] as Tier[]) {
      if (massa <= 0) break;
      const ids = participantes.filter((x) => (x.tier ?? 3) === tier && saldo(x.id) > 0).map((x) => x.id);
      if (!ids.length) continue;
      const lim: Record<string, number> = {}; ids.forEach((id) => (lim[id] = saldo(id)));
      const { out, resto } = partilhar(massa, ids, pesos, lim);
      Object.entries(out).forEach(([id, v]) => pagar(id, v));
      if (massa - resto > 0) transbordo.push({ tier, valor: r(massa - resto) });
      massa = resto;
    }
    const usadoPool = poolC - massa;
    const capados: string[] = [];
    participantes.forEach((p) => { if (tetosC[p.id]! > 0 && saldo(p.id) <= 0 && !quitacao[p.id]) { quitacao[p.id] = parcela.vencimento; capados.push(p.id); } });
    acumulado += usadoPool;
    if (!liberacao && totalC > 0 && acumulado >= totalC) liberacao = parcela.vencimento;
    const pagamentos: Record<string, number> = {};
    Object.entries(pagC).forEach(([k, v]) => (pagamentos[k] = r(v)));
    eventos.push({ parcela, pool: r(usadoPool), pagamentos, acumuladoTotal: r(acumulado), liquidaFluxo: r(c(parcela.valor) - usadoPool), transbordo, capados });
  });

  const tetos: Record<string, number> = {};
  const pagos: Record<string, number> = {};
  participantes.forEach((p) => { tetos[p.id] = r(tetosC[p.id]!); pagos[p.id] = r(pagosC[p.id]!); });
  return { totalComissao: r(totalC), tetos, pagos, eventos, quitacao, liberacao, saldoPendente: r(totalC - acumulado), modalidade };
}
