import { describe, expect, it } from "vitest";
import { caminhoDocumento, validarDocumento } from "../lib/documentos-regras";
describe("Documentos por proposta", () => {
  it("separa os arquivos de cada proposta", () => {
    expect(caminhoDocumento("proposta-A", "cpf-1")).toBe("proposta-A/cpf-1/arquivo");
    expect(caminhoDocumento("proposta-B", "cpf-1")).toBe("proposta-B/cpf-1/arquivo");
  });
  it("mantém arquivos distintos mesmo com o mesmo nome", () => {
    expect(caminhoDocumento("A", "doc1")).not.toBe(caminhoDocumento("A", "doc2"));
  });
  it("preserva os formatos aceitos e o limite de envio existente", () => {
    expect(validarDocumento({ name: "cpf.pdf", type: "application/pdf", size: 10 * 1024 * 1024 })).toBeNull();
    expect(validarDocumento({ name: "cpf.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 })).not.toBeNull();
    expect(validarDocumento({ name: "vazio.pdf", type: "application/pdf", size: 0 })).not.toBeNull();
    expect(validarDocumento({ name: "a.exe", type: "application/octet-stream", size: 10 })).not.toBeNull();
  });
});