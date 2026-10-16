import { describe, it, expect } from "vitest";
import { localizar, type Palavra } from "@/lib/trechos";

const linha = (txt: string, y: number, page = 0): Palavra[] =>
  txt.split(" ").map((t, i) => ({ text: t, x0: i * 100, x1: i * 100 + 90, y0: y, y1: y + 20, page }));
const doc = [...linha("Comprador: João Pedro Almeida CPF 321.654.987-00", 0), ...linha("Preço total: R$ 900.000,00", 40)];

describe("localização de trechos", () => {
  it("encontra o trecho ignorando acentos e pontuação", () => {
    const c = localizar("Joao Pedro Almeida", doc);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ x0: 100, x1: 390, y0: 0 });
  });
  it("devolve uma caixa por linha quando o trecho quebra de linha", () => {
    expect(localizar("CPF 321.654.987-00 Preço total", doc)).toHaveLength(2);
  });
  it("não destaca trecho inexistente", () => {
    expect(localizar("Financiamento bancário", doc)).toEqual([]);
  });
});
