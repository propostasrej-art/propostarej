import type { Funcao, Membro } from "./store";

export const COLUNAS_MEMBROS = ["Nome", "Apelido", "CPF/CNPJ", "CRECI", "Telefone", "E-mail", "Função"];
export const FUNCOES_MEMBROS: Funcao[] = ["Corretor", "Gerente", "Diretor Comercial", "Jurídico", "Imobiliária"];
export type MembroImportado = Omit<Membro, "id">;
export interface LinhaMembro { linha: number; membro: MembroImportado; erros: string[] }
const normalizar = (s: string) => s.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const documento = (s: string) => s.replace(/\D/g, "");

export function validarPlanilhaMembros(linhas: string[][], existentes: Membro[]): LinhaMembro[] {
  const cabecalho = linhas[0] ?? [];
  if (COLUNAS_MEMBROS.some((c, i) => normalizar(cabecalho[i] ?? "") !== normalizar(c))) {
    throw new Error("Colunas diferentes do modelo. Baixe a planilha modelo e mantenha seus títulos e ordem.");
  }
  const emails = new Set(existentes.map((m) => normalizar(m.email ?? "")).filter(Boolean));
  const documentos = new Set(existentes.map((m) => documento(m.doc)).filter(Boolean));
  return linhas.slice(1).flatMap((valores, index) => {
    if (valores.every((v) => !v.trim())) return [];
    const [nome = "", apelido = "", doc = "", creci = "", telefone = "", email = "", cargo = ""] = valores.map((v) => v.trim());
    const funcao = FUNCOES_MEMBROS.find((f) => normalizar(f) === normalizar(cargo));
    const erros: string[] = [];
    if (!nome) erros.push("Nome obrigatório");
    if (!funcao) erros.push("Função inválida");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push("E-mail inválido");
    const cpf = documento(doc);
    if (doc && cpf.length !== 11 && cpf.length !== 14) erros.push("CPF/CNPJ deve ter 11 ou 14 dígitos");
    if (cpf && documentos.has(cpf)) erros.push("CPF/CNPJ já cadastrado ou repetido na planilha");
    if (email && emails.has(normalizar(email))) erros.push("E-mail já cadastrado ou repetido na planilha");
    if (cpf) documentos.add(cpf);
    if (email) emails.add(normalizar(email));
    return [{ linha: index + 2, membro: { nome, apelido, doc, creci, telefone, email: email.toLowerCase(), funcao: funcao ?? "Corretor" }, erros }];
  });
}

export async function baixarModeloMembros() {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Membros");
  sheet.columns = COLUNAS_MEMBROS.map((header) => ({ header, width: header === "Nome" || header === "E-mail" ? 32 : 24, style: { numFmt: "@" } }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = "A1:G1";
  for (let row = 2; row <= 1001; row++) {
    sheet.getCell(row, 7).dataValidation = { type: "list", allowBlank: false, formulae: [`"${FUNCOES_MEMBROS.join(",")}"`], showErrorMessage: true, errorTitle: "Função inválida", error: "Selecione uma função da lista." };
  }
  const dados = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(dados)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-equipe-rj.xlsx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function lerPlanilhaMembros(file: File): Promise<string[][]> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Selecione uma planilha Excel (.xlsx). Use a planilha modelo.");
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet("Membros") ?? workbook.worksheets[0];
  if (!sheet) throw new Error("A planilha está vazia.");
  const linhas: string[][] = [];
  for (let row = 1; row <= sheet.actualRowCount; row++) {
    linhas.push(COLUNAS_MEMBROS.map((_, i) => sheet.getCell(row, i + 1).text));
  }
  return linhas;
}