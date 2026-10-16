import { Mono, Pill, Td, Th } from "./kit";
import type { Membro } from "@/lib/store";

export function CredenciaisTable({ membros }: { membros: Membro[] }) {
  return (
    <table className="w-full"><thead><tr><Th>Nome</Th><Th>Apelido</Th><Th>CPF/CNPJ</Th><Th>CRECI</Th><Th>Cargo na Operação</Th></tr></thead>
      <tbody>{membros.map((m) => (
        <tr key={m.id}><Td className="font-medium">{m.nome}</Td><Td>{m.apelido}</Td><Td><Mono>{m.doc}</Mono></Td><Td><Mono>{m.creci}</Mono></Td><Td><Pill>{m.funcao}</Pill></Td></tr>
      ))}</tbody></table>
  );
}
