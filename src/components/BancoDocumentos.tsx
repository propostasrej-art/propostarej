import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Input, Select } from "./kit";
import { abrirDocumento, chaveDocumentos, excluirDocumento, listarDocumentos, type DocumentoLocal, type DocumentoSalvo } from "@/lib/documentos";
import { TIPOS_DOCUMENTO } from "@/lib/documentos-regras";

export function BancoDocumentos({ propostaId, salva, locais, onAdd, onOpen, onRemove, disabled }: {
  propostaId: string; salva: boolean; locais: DocumentoLocal[]; disabled: boolean;
  onAdd: (files: File[], tipo: string) => void; onOpen: (doc: DocumentoLocal) => void; onRemove: (id: string) => void;
}) {
  const [tipo, setTipo] = useState("Documento adicional");
  const [busca, setBusca] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const cache = useQueryClient();
  const query = useQuery({ queryKey: chaveDocumentos(propostaId), queryFn: () => listarDocumentos(propostaId), enabled: salva });
  const salvos = query.data ?? [];
  const pendentes = locais.filter((d) => !d.salvo && !salvos.some((s) => s.id === d.id));
  const filtrar = (nome: string, tipo: string) => `${nome} ${tipo}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"));
  function baixar(doc: DocumentoLocal) {
    const url = URL.createObjectURL(doc.file);
    const a = document.createElement("a"); a.href = url; a.download = doc.file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function acao(doc: DocumentoSalvo, action: "abrir" | "baixar" | "excluir") {
    if (action === "excluir" && !confirm(`Excluir o documento "${doc.nome}" desta proposta?`)) return;
    setBusy(doc.id);
    try {
      if (action === "excluir") {
        await excluirDocumento(doc); onRemove(doc.id);
        await cache.invalidateQueries({ queryKey: chaveDocumentos(propostaId) }); toast.success("Documento excluído.");
      } else {
        const local = await abrirDocumento(doc);
        if (action === "baixar") baixar(local); else onOpen(local);
      }
    } catch { toast.error("Não foi possível acessar o documento. Tente novamente."); }
    finally { setBusy(null); }
  }
  return <Card title="Banco de documentos">
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Tipo do documento para arquivar" value={tipo} onChange={(e) => setTipo(e.target.value)} className="min-w-0 flex-1">{TIPOS_DOCUMENTO.map((t) => <option key={t}>{t}</option>)}</Select>
        <Btn variant="outline" disabled={disabled} onClick={() => input.current?.click()}><Upload className="h-4 w-4" />Anexar</Btn>
        <input ref={input} type="file" aria-label="Anexar documentos à proposta" className="hidden" multiple accept=".pdf,.txt,image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { onAdd(Array.from(e.target.files ?? []), tipo); e.target.value = ""; }} />
      </div>
      <Input aria-label="Buscar documento" placeholder="Buscar documento..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      {query.isError && <div className="text-sm text-destructive">Não foi possível carregar os documentos. <Btn variant="ghost" onClick={() => query.refetch()}>Tentar novamente</Btn></div>}
      {query.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      <div className="divide-y">
        {salvos.filter((d) => filtrar(d.nome, d.tipo)).map((d) => <div key={d.id} className="flex items-center gap-2 py-3">
          <FileText className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium" title={d.nome}>{d.nome}</div><div className="text-xs text-muted-foreground">{d.tipo} · <span className="font-mono">{(d.tamanho / 1024).toFixed(0)} KB · {new Date(d.created_at).toLocaleDateString("pt-BR")}</span></div></div>
          {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="flex shrink-0">
            <Btn variant="ghost" className="px-2" title="Visualizar documento" aria-label={`Visualizar ${d.nome}`} disabled={disabled || !!busy} onClick={() => acao(d, "abrir")}><Eye className="h-4 w-4" /></Btn>
            <Btn variant="ghost" className="px-2" title="Baixar documento" aria-label={`Baixar ${d.nome}`} disabled={disabled || !!busy} onClick={() => acao(d, "baixar")}><Download className="h-4 w-4" /></Btn>
            <Btn variant="danger" className="px-2" title="Excluir documento" aria-label={`Excluir ${d.nome}`} disabled={disabled || !!busy} onClick={() => acao(d, "excluir")}><Trash2 className="h-4 w-4" /></Btn>
          </div>}
        </div>)}
        {pendentes.filter((d) => filtrar(d.file.name, d.tipo)).map((d) => <div key={d.id} className="flex items-center gap-2 py-3">
          <FileText className="h-5 w-5 shrink-0 text-warn-foreground" />
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{d.file.name}</div><div className="text-xs text-muted-foreground">{d.tipo} · Aguardando salvar proposta</div></div>
          <Btn variant="ghost" className="px-2" title="Visualizar documento" aria-label={`Visualizar ${d.file.name}`} onClick={() => onOpen(d)}><Eye className="h-4 w-4" /></Btn>
          <Btn variant="danger" className="px-2" title="Remover anexo" aria-label={`Remover ${d.file.name}`} disabled={disabled} onClick={() => onRemove(d.id)}><Trash2 className="h-4 w-4" /></Btn>
        </div>)}
      </div>
      {!salvos.length && !pendentes.length && !query.isLoading && <p className="text-sm text-muted-foreground">Nenhum documento nesta proposta.</p>}
    </div>
  </Card>;
}