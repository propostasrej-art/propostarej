import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { DOCUMENTOS_BUCKET, caminhoDocumento, validarDocumento } from "./documentos-regras";
export type DocumentoSalvo = Database["public"]["Tables"]["documentos_proposta"]["Row"];
export type DocumentoLocal = { id: string; slot: string; tipo: string; file: File; trechos: Record<string, string>; rotulos: Record<string, string>; salvo?: boolean };
export const chaveDocumentos = (id: string) => ["documentos-proposta", id];
export async function listarDocumentos(id: string) {
  const { data, error } = await supabase.from("documentos_proposta").select("*").eq("proposta_id", id).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function guardarDocumento(propostaId: string, doc: DocumentoLocal) {
  const erro = validarDocumento(doc.file);
  if (erro) throw new Error(erro);
  const caminho = caminhoDocumento(propostaId, doc.id);
  const mime = doc.file.type || (/\.txt$/i.test(doc.file.name) ? "text/plain" : "application/pdf");
  const { error: uploadError } = await supabase.storage.from(DOCUMENTOS_BUCKET).upload(caminho, doc.file, { contentType: mime, upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from("documentos_proposta").insert({ id: doc.id, proposta_id: propostaId, nome: doc.file.name, tipo: doc.tipo, caminho, mime, tamanho: doc.file.size, trechos: doc.trechos, rotulos: doc.rotulos });
  if (error) {
    await supabase.storage.from(DOCUMENTOS_BUCKET).remove([caminho]);
    throw error;
  }
}
export async function abrirDocumento(doc: DocumentoSalvo): Promise<DocumentoLocal> {
  const { data, error } = await supabase.storage.from(DOCUMENTOS_BUCKET).download(doc.caminho);
  if (error) throw error;
  return { id: doc.id, slot: doc.tipo, tipo: doc.tipo, file: new File([data], doc.nome, { type: doc.mime }), trechos: doc.trechos as Record<string, string>, rotulos: doc.rotulos as Record<string, string>, salvo: true };
}
export async function excluirDocumento(doc: DocumentoSalvo) {
  const { error: storageError } = await supabase.storage.from(DOCUMENTOS_BUCKET).remove([doc.caminho]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("documentos_proposta").delete().eq("id", doc.id);
  if (error) throw error;
}