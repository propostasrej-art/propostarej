import { useRef, useState } from "react";
import { Download, Upload, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Pill, Td, Th } from "./kit";
import { baixarModeloMembros, lerPlanilhaMembros, separarLinhasMembros, validarPlanilhaMembros, type LinhaMembro } from "@/lib/importar-membros";
import { getState, setState } from "@/lib/store";
import { uid } from "@/lib/format";

export function ImportarMembros() {
  const input = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [linhas, setLinhas] = useState<LinhaMembro[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [erro, setErro] = useState("");
  const invalidas = linhas.filter((l) => l.erros.length > 0).length;
  const validas = linhas.length - invalidas;

  const carregar = async (file: File) => {
    setOcupado(true); setLinhas([]); setErro(""); setArquivo(file.name);
    try {
      const resultado = validarPlanilhaMembros(await lerPlanilhaMembros(file), getState().membros);
      if (!resultado.length) throw new Error("Nenhum membro encontrado na planilha.");
      setLinhas(resultado);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível ler a planilha. Verifique o arquivo."); }
    finally { setOcupado(false); }
  };
  const importar = async () => {
    if (ocupado || !validas) return;
    // Revalidate against the latest store before writing, without changing existing members.
    const revisadas = validarPlanilhaMembros([
      ["Nome", "Apelido", "CPF/CNPJ", "CRECI", "Telefone", "E-mail", "Função"],
      ...linhas.map(({ membro: m }) => [m.nome, m.apelido, m.doc, m.creci, m.telefone, m.email ?? "", m.funcao]),
    ], getState().membros);
    const { validas: prontas, pendentes } = separarLinhasMembros(revisadas.map((l, i) => ({ ...l, linha: linhas[i]?.linha ?? l.linha })));
    if (!prontas.length) { setLinhas(pendentes); return; }
    setOcupado(true);
    try {
      const sucesso = await setState((s) => ({ ...s, membros: [...s.membros, ...prontas.map((l) => ({ ...l.membro, id: uid() }))] }));
      if (sucesso) {
        toast.success(`${prontas.length} membros importados e salvos.${pendentes.length ? ` ${pendentes.length} linhas não importadas por pendências.` : ""}`);
        setLinhas(pendentes);
        if (!pendentes.length) { setArquivo(""); setAberto(false); }
      }
    } catch { toast.error("Não foi possível salvar os membros. Tente novamente."); }
    finally { setOcupado(false); }
  };
  const baixar = async () => {
    setOcupado(true);
    try { await baixarModeloMembros(getState().membros); } catch { toast.error("Não foi possível baixar o modelo."); }
    finally { setOcupado(false); }
  };
  return <>
    <div className="mb-4 flex flex-wrap gap-2">
      <Btn variant="outline" disabled={ocupado} onClick={baixar}><Download className="h-4 w-4" />Baixar planilha modelo</Btn>
      <Btn variant="outline" disabled={ocupado} onClick={() => { setAberto(true); input.current?.click(); }}><Upload className="h-4 w-4" />Importar planilha</Btn>
      <input ref={input} type="file" accept=".xlsx" aria-label="Planilha de membros" className="hidden" disabled={ocupado} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void carregar(file); }} />
    </div>
    {aberto && <Card className="mb-6" title="Importação de membros" action={<Btn variant="ghost" aria-label="Fechar importação" disabled={ocupado} onClick={() => { setAberto(false); setLinhas([]); setErro(""); }}><X className="h-4 w-4" /></Btn>}>
      <div className="flex flex-wrap items-center gap-3"><span className="break-all text-sm font-medium">{arquivo}</span>{ocupado && <Loader2 className="h-4 w-4 animate-spin" />}{linhas.length > 0 && <><Pill tone="success">{linhas.length - invalidas} válidos</Pill>{invalidas > 0 && <Pill tone="danger">{invalidas} com pendências</Pill>}</>}</div>
      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      {linhas.length > 0 && <div className="mt-4 max-h-96 overflow-auto"><table className="w-full"><thead><tr><Th>Linha</Th><Th>Nome</Th><Th>CPF/CNPJ</Th><Th>E-mail</Th><Th>Função</Th><Th>Validação</Th></tr></thead><tbody>{linhas.map((l) => <tr key={l.linha}><Td>{l.linha}</Td><Td>{l.membro.nome}</Td><Td className="font-mono whitespace-nowrap">{l.membro.doc}</Td><Td>{l.membro.email}</Td><Td>{l.membro.funcao}</Td><Td>{l.erros.length ? <span className="text-destructive">{l.erros.join("; ")}</span> : <Pill tone="success">Pronto</Pill>}</Td></tr>)}</tbody></table></div>}
      {invalidas > 0 && <p role="alert" className="mt-3 text-sm text-destructive">{invalidas} linhas com pendências não serão importadas. {validas > 0 ? `${validas} membros válidos podem ser importados agora.` : "Nenhum membro válido disponível para importar."}</p>}
      <div className="mt-4 flex flex-wrap gap-2"><Btn disabled={ocupado || !validas} onClick={importar}><Check className="h-4 w-4" />Confirmar importação{linhas.length > 0 ? ` (${validas})` : ""}</Btn><Btn variant="outline" disabled={ocupado} onClick={() => input.current?.click()}><Upload className="h-4 w-4" />Selecionar planilha</Btn></div>
    </Card>}
  </>;
}