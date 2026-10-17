export const DOCUMENTOS_BUCKET = "documentos-propostas";
export const LIMITE_DOCUMENTO = 10 * 1024 * 1024;
export const TIPOS_DOCUMENTO = ["Documento de identidade (RG/CNH)", "CPF", "Comprovante de residência", "Comprovante de estado civil", "Proposta", "Documento adicional"];
export function validarDocumento(file: { size: number; type: string; name: string }): string | null {
  if (!file.size) return "Arquivo vazio ou corrompido.";
  if (file.size > LIMITE_DOCUMENTO) return "Arquivo acima de 10 MB.";
  const mime = file.type || (/\.txt$/i.test(file.name) ? "text/plain" : /\.pdf$/i.test(file.name) ? "application/pdf" : "");
  return ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "text/plain"].includes(mime) ? null : "Use PDF, JPG, PNG, WEBP, GIF ou TXT.";
}
export function caminhoDocumento(propostaId: string, documentoId: string): string {
  return `${propostaId}/${documentoId}/arquivo`;
}