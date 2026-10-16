import { describe, expect, it } from "vitest";
import { agruparParcelas, expandirLinhas, totalLinha, type LinhaParcelas } from "../lib/parcelas-tabela";

const linha: LinhaParcelas = { id: "a", ids: ["a"], quantidade: 3, tipo: "Mensal", valor: 1250.5, vencimento: "2026-01-31" };
describe("Tabela de parcelas", () => {
  it("calcula o valor total pela quantidade e valor unitário", () => {
    expect(totalLinha(linha)).toBe(3751.5);
  });
  it("preserva o primeiro vencimento e gera as parcelas mensais sem perder o dia de referência", () => {
    const parcelas = expandirLinhas([linha], () => "novo");
    expect(parcelas.map((p) => p.vencimento)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(parcelas.map((p) => p.valor)).toEqual([1250.5, 1250.5, 1250.5]);
    expect(parcelas[0]?.id).toBe("a");
  });
  it("mantém vencimentos semestrais com intervalo de seis meses", () => {
    expect(expandirLinhas([{ ...linha, tipo: "Semestral", quantidade: 2 }], () => "b").map((p) => p.vencimento)).toEqual(["2026-01-31", "2026-07-31"]);
  });
  it("agrupa parcelas recorrentes preservando todos os identificadores da extração", () => {
    let id = 0;
    const parcelas = expandirLinhas([linha], () => String(++id));
    const agrupadas = agruparParcelas(parcelas);
    expect(agrupadas).toHaveLength(1);
    expect(agrupadas[0]?.quantidade).toBe(3);
    expect(agrupadas[0]?.ids).toEqual(["a", "1", "2"]);
    expect(expandirLinhas(agrupadas, () => "extra")).toEqual(parcelas);
  });
});