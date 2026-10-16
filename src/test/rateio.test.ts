import { describe, it, expect } from "vitest";
import { calcularRateio, RETENCAO_PADRAO } from "@/lib/rateio";

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
