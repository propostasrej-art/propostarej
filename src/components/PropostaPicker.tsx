import { Select } from "./kit";
import { useStore } from "@/lib/store";

export function PropostaPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const s = useStore((x) => x);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-auto min-w-64">
      {s.propostas.map((p) => {
        const e = s.empreendimentos.find((x) => x.id === p.empreendimentoId);
        return <option key={p.id} value={p.id}>{e?.nome} · Un. {p.unidade} · {p.compradores[0]?.nome}</option>;
      })}
    </Select>
  );
}
