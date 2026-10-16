import { describe, expect, it } from "vitest";
import { nomesTiposParcela, podeCriarTipoParcela, validarNomeTipo } from "../lib/tipos-parcela";
import { calcularRateio, RETENCAO_PADRAO } from "../lib/rateio";

describe("Tipos de parcela", () => {
  it("permite criar tipos somente para Admin", () => {
    expect(podeCriarTipoParcela("Admin")).toBe(true);
    expect(podeCriarTipoParcela("Gerente")).toBe(false);
    expect(podeCriarTipoParcela("Corretor")).toBe(false);
    expect(podeCriarTipoParcela(null)).toBe(false);
  });
  it("disponibiliza o tipo cadastrado junto aos padrões nas propostas", () => {
    const tipos = nomesTiposParcela([{ id: "1", nome: "Intermediária" }]);
    expect(tipos).toContain("Intermediária");
    expect(tipos).toContain("Mensal");
    expect(tipos).toContain("FGTS");
  });
  it("recusa nomes duplicados mesmo com espaços e caixa diferente", () => {
    expect(validarNomeTipo(" mensal ", [])).not.toBeNull();
    expect(validarNomeTipo(" INTERMEDIÁRIA ", [{ id: "1", nome: "Intermediária" }])).not.toBeNull();
    expect(validarNomeTipo("Intermediária", [])).toBeNull();
  });
  it("aplica a retenção configurada ao tipo personalizado", () => {
    const parcela = { id: "1", tipo: "Intermediária", valor: 1000, vencimento: "2026-10-16" };
    const participante = [{ id: "c", nome: "Corretor", pct: 5 }];
    expect(calcularRateio(100000, participante, [parcela], RETENCAO_PADRAO).eventos[0]?.pool).toBe(0);
    expect(calcularRateio(100000, participante, [parcela], { ...RETENCAO_PADRAO, Intermediária: 50 }).eventos[0]?.pool).toBe(500);
  });
});