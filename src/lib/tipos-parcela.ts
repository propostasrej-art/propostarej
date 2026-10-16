import { TIPOS_PARCELA } from "./rateio";

export interface TipoParcelaCadastro { id: string; nome: string }
export const podeCriarTipoParcela = (papel: string | null | undefined) => papel === "Admin";
export function nomesTiposParcela(cadastrados: TipoParcelaCadastro[], existentes: string[] = []) {
  return [...new Set([...TIPOS_PARCELA, ...cadastrados.map((t) => t.nome), ...existentes])];
}
export function validarNomeTipo(nome: string, cadastrados: TipoParcelaCadastro[]) {
  const limpo = nome.trim();
  if (!limpo || limpo.length > 80) return "Informe um nome com até 80 caracteres.";
  if (nomesTiposParcela(cadastrados).some((t) => t.toLocaleLowerCase("pt-BR") === limpo.toLocaleLowerCase("pt-BR"))) return "Este tipo de parcela já existe.";
  return null;
}