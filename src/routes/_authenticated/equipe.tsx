import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Btn, Card, Field, Input, Mono, PageHeader, Pill, Select, Td, Th } from "@/components/kit";
import { setState, useStore, type Funcao, type Membro } from "@/lib/store";
import { uid } from "@/lib/format";
import { meta } from "@/lib/helpers";
import { ImportarMembros } from "@/components/ImportarMembros";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => meta("Equipe e Cargos", "Cadastro de corretores, gerentes e gestores."),
  component: Equipe,
});
const FUNCOES: Funcao[] = ["Corretor", "Gerente", "Diretor Comercial", "Jurídico", "Imobiliária"];

function Equipe() {
  const list = useStore((s) => s.membros);
  const papel = useStore((s) => s.eu?.papel);
  const [m, setM] = useState<Membro | null>(null);
  const save = () => { if (!m) return; setState((s) => ({ ...s, membros: s.membros.some((x) => x.id === m.id) ? s.membros.map((x) => (x.id === m.id ? m : x)) : [...s.membros, m] })); setM(null); };
  const f = (k: keyof Membro, label: string, mono = false) => m && <Field label={label}><Input className={mono ? "font-mono" : ""} value={(m[k] ?? "") as string} onChange={(e) => setM({ ...m, [k]: e.target.value })} /></Field>;
  return (
    <div>
      <PageHeader title="Equipe e Cargos" actions={<Btn onClick={() => setM({ id: uid(), nome: "", apelido: "", doc: "", creci: "", telefone: "", email: "", funcao: "Corretor" })}><Plus className="h-4 w-4" />Novo membro</Btn>} />
      {(papel === "Admin" || papel === "Gerente") && <ImportarMembros />}
      {m && (
        <Card className="mb-6" title="Membro">
          <div className="grid gap-4 sm:grid-cols-3">{f("nome", "Nome")}{f("apelido", "Apelido")}{f("doc", "CPF/CNPJ", true)}{f("creci", "CRECI", true)}{f("telefone", "Telefone", true)}{f("email", "E-mail")}
            <Field label="Função"><Select value={m.funcao} onChange={(e) => setM({ ...m, funcao: e.target.value as Funcao })}>{FUNCOES.map((x) => <option key={x}>{x}</option>)}</Select></Field></div>
          <div className="mt-4 flex gap-2"><Btn onClick={save}>Salvar</Btn><Btn variant="outline" onClick={() => setM(null)}>Cancelar</Btn></div>
        </Card>
      )}
      <Card><div className="overflow-x-auto"><table className="w-full"><thead><tr><Th>Nome</Th><Th>Apelido</Th><Th>CPF/CNPJ</Th><Th>CRECI</Th><Th>Telefone</Th><Th>E-mail</Th><Th>Função</Th><Th>Gerente</Th><Th>Diretor</Th><Th /></tr></thead><tbody>
        {list.map((x) => (<tr key={x.id}><Td className="font-medium">{x.nome}</Td><Td>{x.apelido}</Td><Td><Mono>{x.doc}</Mono></Td><Td><Mono>{x.creci}</Mono></Td><Td><Mono>{x.telefone}</Mono></Td><Td>{x.email}</Td><Td><Pill>{x.funcao}</Pill></Td>
          <Td>{x.funcao === "Gerente" ? <Pill className="bg-emerald-100 text-emerald-700">✓</Pill> : <span className="text-muted-foreground">—</span>}</Td><Td>{x.funcao === "Diretor Comercial" ? <Pill className="bg-emerald-100 text-emerald-700">✓</Pill> : <span className="text-muted-foreground">—</span>}</Td>
          <Td className="whitespace-nowrap"><Btn variant="ghost" onClick={() => setM({ ...x })}>Editar</Btn><Btn variant="danger" onClick={() => setState((s) => ({ ...s, membros: s.membros.filter((y) => y.id !== x.id) }))}><Trash2 className="h-4 w-4" /></Btn></Td></tr>))}
      </tbody></table></div></Card>
    </div>
  );
}
