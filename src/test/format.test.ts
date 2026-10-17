import { describe, expect, it } from "vitest";
import { brl, moedaEdicao, parseMoedaBR } from "../lib/format";

// O espaço entre "R$" e o número é um espaço insensível (U+00A0) gerado pelo locale.
const limpa = (s: string) => s.replace(/\u00a0/g, " ");

describe("Valores em Real", () => {
  it("mostra R$ com duas casas decimais", () => {
    expect(limpa(brl(1251.39))).toBe("R$ 1.251,39");
    expect(limpa(brl(0))).toBe("R$ 0,00");
  });
  it("lê o valor digitado em Real", () => {
    expect(parseMoedaBR("1.251,39")).toBe(1251.39);
    expect(parseMoedaBR("R$ 12.000,00")).toBe(12000);
    expect(parseMoedaBR("94998,")).toBe(94998);
    expect(parseMoedaBR("94998")).toBe(94998);
    expect(parseMoedaBR("1251.39")).toBe(1251.39);
    expect(parseMoedaBR("")).toBe(0);
    expect(parseMoedaBR("abc")).toBe(0);
  });
  it("prepara o valor para digitação", () => {
    expect(moedaEdicao(1251.39)).toBe("1251,39");
    expect(moedaEdicao(206000)).toBe("206000");
    expect(moedaEdicao(0)).toBe("");
  });
});
