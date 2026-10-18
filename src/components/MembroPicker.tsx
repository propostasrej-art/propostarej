import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Membro } from "@/lib/store";

const norm = (v: string) => (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Pontuação: apelido tem prioridade sobre o nome; prefixo/exato sobem no topo. */
function pontuar(m: Membro, q: string): number {
  const ap = norm(m.apelido), no = norm(m.nome);
  if (!q) return 1;
  if (ap === q) return 100;
  if (ap.startsWith(q)) return 90;
  if (ap.includes(q)) return 80;
  if (no === q) return 70;
  if (no.startsWith(q)) return 60;
  if (no.includes(q)) return 50;
  return 0;
}

/** Campo de busca de membros (lupa): filtra por apelido ou nome e seleciona na lista. */
export function MembroPicker({ membros, value, onChange, invalid }: { membros: Membro[]; value: string; onChange: (id: string) => void; invalid?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const sel = membros.find((m) => m.id === value);

  const resultados = useMemo(() => {
    const q = norm(busca);
    return membros
      .map((m) => ({ m, s: pontuar(m, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.m.nome.localeCompare(b.m.nome))
      .map((x) => x.m);
  }, [membros, busca]);

  const fechar = () => { setAberto(false); setBusca(""); };
  const escolher = (id: string) => { onChange(id); fechar(); };

  return (
    <div ref={ref} className="relative flex-1" onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) fechar(); }}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Buscar participante"
        onClick={() => setAberto(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAberto(true); } }}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
          invalid && "border-destructive"
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        {aberto && !sel ? (
          <input
            autoFocus
            aria-label="Buscar membro por apelido ou nome"
            placeholder="Digite apelido ou nome..."
            className="w-full bg-transparent outline-none"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") fechar();
              if (e.key === "Enter" && resultados[0]) escolher(resultados[0].id);
            }}
          />
        ) : sel ? (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="font-medium">{sel.nome}</span>
            {sel.apelido && <span className="truncate text-xs text-muted-foreground">“{sel.apelido}”</span>}
            <span className="ml-auto hidden shrink-0 text-xs text-muted-foreground sm:inline">{sel.funcao}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Buscar participante…</span>
        )}
      </div>
      {aberto && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-card py-1 shadow-lg">
          {resultados.length ? resultados.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(m.id)}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{m.nome}</span>
                {m.apelido && <span className="text-xs text-muted-foreground">“{m.apelido}”</span>}
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{m.funcao}</span>
              </button>
            </li>
          )) : <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum membro encontrado.</li>}
        </ul>
      )}
    </div>
  );
}
