import { describe, expect, it } from "vitest";
import { COLUNAS_MEMBROS, separarLinhasMembros, validarPlanilhaMembros } from "../lib/importar-membros";

const linha = ["Ana Silva", "Ana", "01234567890", "12345", "11987654321", "ana@exemplo.com", "Corretor"];
describe("Importação em massa de membros", () => {
  it("permite importar membros válidos mesmo com erros em outras linhas", () => {
    const resultado = validarPlanilhaMembros([COLUNAS_MEMBROS, linha, ["", "", "", "", "", "invalido", "Admin"]], []);
    const { validas, pendentes } = separarLinhasMembros(resultado);
    expect(validas.map((l) => l.membro.nome)).toEqual(["Ana Silva"]);
    expect(pendentes.map((l) => l.linha)).toEqual([3]);
    expect(pendentes[0]?.erros).toHaveLength(3);
  });
  it("não reimporta membros já cadastrados durante uma confirmação parcial", () => {
    const existente = { id: "existente", nome: "Ana Silva", apelido: "Ana", doc: "01234567890", creci: "12345", telefone: "11987654321", email: "ana@exemplo.com", funcao: "Corretor" as const };
    const resultado = validarPlanilhaMembros([COLUNAS_MEMBROS, linha, ["João", "", "", "", "", "joao@exemplo.com", "Gerente"]], [existente]);
    expect(separarLinhasMembros(resultado).validas.map((l) => l.membro.nome)).toEqual(["João"]);
    expect(separarLinhasMembros(resultado).pendentes[0]?.membro.nome).toBe("Ana Silva");
  });
  it("converte todos os campos sem perder zeros e preserva vários membros", () => {
    const resultado = validarPlanilhaMembros([COLUNAS_MEMBROS, linha, ["João", "", "", "", "", "joao@exemplo.com", "Gerente"]], []);
    expect(resultado).toHaveLength(2);
    expect(resultado[0]?.membro).toEqual({ nome: "Ana Silva", apelido: "Ana", doc: "01234567890", creci: "12345", telefone: "11987654321", email: "ana@exemplo.com", funcao: "Corretor" });
    expect(resultado.every((l) => l.erros.length === 0)).toBe(true);
  });
  it("identifica duplicatas na planilha e no cadastro", () => {
    const resultado = validarPlanilhaMembros([COLUNAS_MEMBROS, linha, linha], []);
    expect(resultado[1]?.erros).toHaveLength(2);
    const primeiro = resultado[0];
    if (!primeiro) throw new Error("Membro não encontrado");
    const repetido = validarPlanilhaMembros([COLUNAS_MEMBROS, linha], [{ id: "existente", ...primeiro.membro }]);
    expect(repetido[0]?.erros).toHaveLength(2);
  });
  it("recusa nome ausente, função desconhecida e e-mail malformado", () => {
    const resultado = validarPlanilhaMembros([COLUNAS_MEMBROS, ["", "", "", "", "", "invalido", "Admin"]], []);
    expect(resultado[0]?.erros).toEqual(["Nome obrigatório", "Função inválida", "E-mail inválido"]);
  });
  it("ignora linhas vazias mantendo a linha real para revisão", () => {
    const resultado = validarPlanilhaMembros([COLUNAS_MEMBROS, ["", "", ""], linha], []);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.linha).toBe(3);
  });
  it("recusa planilha com cabeçalhos fora do modelo", () => {
    expect(() => validarPlanilhaMembros([["Nome", "Função"], linha], [])).toThrow();
  });
  it("aceita as colunas extras Gerente/Diretor do modelo atualizado", () => {
    const resultado = validarPlanilhaMembros([[...COLUNAS_MEMBROS, "Gerente", "Diretor"], [...linha, "✓", "—"]], []);
    expect(resultado[0]?.erros).toHaveLength(0);
    expect(resultado[0]?.membro.funcao).toBe("Corretor");
  });
});