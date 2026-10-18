import { describe, it, expect } from "vitest";
import { ajustarAliquotas, calcularRateio, RETENCAO_PADRAO } from "@/lib/rateio";

const parts = [{ id: "c", nome: "Corretor", pct: 3 }, { id: "g", nome: "Gerente", pct: 2 }];

describe("motor de rateio", () => {
  it("parcelas protegidas não deduzem comissão", () => {
    const r = calcularRateio(1_000_000, parts, [{ id: "1", tipo: "Financiamento Bancário", valor: 800_000, vencimento: "2026-01-01" }], RETENCAO_PADRAO);
    expect(r.eventos[0]!.pool).toBe(0);
    expect(r.saldoPendente).toBe(50_000);
  });
  it("cada participante para no teto e a cascata zera o passivo", () => {
    const r = calcularRateio(1_000_000, parts, [
      { id: "1", tipo: "Sinal/Ato", valor: 30_000, vencimento: "2026-01-01" },
      { id: "2", tipo: "Sinal/Ato", valor: 100_000, vencimento: "2026-02-01" },
    ], RETENCAO_PADRAO);
    expect(r.pagos).toEqual({ c: 30_000, g: 20_000 });
    expect(r.saldoPendente).toBe(0);
    expect(r.liberacao).toBe("2026-02-01");
  });
  it("excedente de quitado vai para o remanescente", () => {
    const r = calcularRateio(1_000_000, [{ id: "a", nome: "A", pct: 1 }, { id: "b", nome: "B", pct: 4 }],
      [{ id: "1", tipo: "Sinal/Ato", valor: 40_000, vencimento: "2026-01-01" }], { ...RETENCAO_PADRAO });
    // pool 40k: a teto 10k (cota 8k), b 32k; total 40k
    expect(r.pagos["a"]! + r.pagos["b"]!).toBe(40_000);
  });
});

describe("manual de rateio (waterfall)", () => {
  it("ATO_FULL liquida o jurídico antes da partilha", () => {
    const r = calcularRateio(100_000, [{ id: "j", nome: "J", pct: 1, atoFull: true, tier: 1 }, { id: "c", nome: "C", pct: 4 }],
      [{ id: "1", tipo: "Sinal/Ato", valor: 2_000, vencimento: "2026-01-01" }], RETENCAO_PADRAO);
    expect(r.eventos[0]!.pagamentos).toEqual({ j: 1_000, c: 1_000 });
  });
  it("sobra desce para o Tier 1 antes do Tier 3", () => {
    const r = calcularRateio(100_000, [{ id: "c", nome: "C", pct: 1, tier: 3 }, { id: "i", nome: "I", pct: 2, tier: 1 }, { id: "c2", nome: "C2", pct: 2, tier: 3 }],
      [{ id: "1", tipo: "Sinal/Ato", valor: 4_000, vencimento: "2026-01-01" }], RETENCAO_PADRAO);
    // ordinária: c 800 (teto 1000), i 1600, c2 1600 → sem sobra; total 4000
    expect(r.pagos["c"]! + r.pagos["i"]! + r.pagos["c2"]!).toBe(4_000);
  });
  it("parcelas do incorporador são protegidas", () => {
    const r = calcularRateio(100_000, parts, [{ id: "1", tipo: "Mensal Incorporador", valor: 10_000, vencimento: "2026-01-01" }], { ...RETENCAO_PADRAO, "Mensal Incorporador": 50 });
    expect(r.eventos[0]!.pool).toBe(0);
  });
  it("NF/Repasse quita tudo no financiamento", () => {
    const r = calcularRateio(1_000_000, parts, [
      { id: "1", tipo: "Sinal/Ato", valor: 30_000, vencimento: "2026-01-01" },
      { id: "2", tipo: "Financiamento Bancário", valor: 800_000, vencimento: "2026-03-01" },
    ], RETENCAO_PADRAO, { modalidade: "repasse" });
    expect(r.eventos[0]!.pool).toBe(0);
    expect(r.eventos[1]!.pool).toBe(50_000);
  });
  it("centavos dos tetos vão para a intermediadora", () => {
    const r = calcularRateio(100_000.01, [{ id: "a", nome: "A", pct: 2.5 }, { id: "b", nome: "B", pct: 2.5, intermediadora: true }], [], RETENCAO_PADRAO);
    expect(r.tetos["a"]! + r.tetos["b"]!).toBe(r.totalComissao);
  });
});

describe("ajuste de alíquotas (etapa 1)", () => {
  it("divide a % do cargo entre os profissionais", () => {
    const r = ajustarAliquotas([{ pct: 1, cargo: "Corretor" }, { pct: 9, cargo: "Corretor" }, { pct: 1, cargo: "Gerente" }], { pctPorCargo: { Corretor: 4 } });
    expect(r.map((x) => x.pct)).toEqual([2, 2, 1]);
  });
  it("escala proporcionalmente à taxa da proposta", () => {
    const r = ajustarAliquotas([{ pct: 3 }, { pct: 1 }], { taxa: 6 });
    expect(r.map((x) => x.pct)).toEqual([4.5, 1.5]);
  });
});
