import { describe, it, expect } from "vitest";
import { nivel, pendentes, precisaRevisao } from "@/lib/confianca";

describe("confiança da extração", () => {
  it("abaixo de 80% precisa de revisão", () => {
    expect(precisaRevisao(0.79)).toBe(true);
    expect(precisaRevisao(0.8)).toBe(false);
  });
  it("classifica níveis", () => {
    expect(nivel(0.95)).toBe("alta");
    expect(nivel(0.6)).toBe("media");
    expect(nivel(0.2)).toBe("baixa");
  });
  it("lista só os campos pendentes", () => {
    expect(pendentes({ unidade: 0.99, cpf: 0.4, vgv: 0.7 })).toEqual(["cpf", "vgv"]);
  });
});
