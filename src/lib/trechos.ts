export interface Palavra { text: string; x0: number; y0: number; x1: number; y1: number; page: number }
export interface Caixa { x0: number; y0: number; x1: number; y1: number; page: number }

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const tokens = (s: string) => s.split(/\s+/).map(norm).filter(Boolean);

/** Localiza o trecho nas palavras reconhecidas (OCR) e devolve uma caixa por linha coberta. */
export function localizar(trecho: string, palavras: Palavra[]): Caixa[] {
  const t = tokens(trecho);
  if (!t.length) return [];
  const w = palavras.map((p) => norm(p.text));
  let best = { score: 0, start: -1, len: 0 };
  for (let i = 0; i < w.length; i++) {
    let hit = 0, j = 0, k = i;
    while (j < t.length && k < w.length && k - i < t.length + 3) {
      const a = w[k]!, b = t[j]!;
      if (a && (a === b || (a.length > 2 && b.length > 2 && (a.includes(b) || b.includes(a))))) { hit++; j++; k++; }
      else if (!a) k++;
      else { j++; if (k === i) break; }
    }
    const score = hit / t.length;
    if (hit && score > best.score) best = { score, start: i, len: k - i };
    if (score === 1) break;
  }
  if (best.score < 0.6) return [];
  const sel = palavras.slice(best.start, best.start + best.len);
  const linhas: Caixa[] = [];
  for (const p of sel) {
    const l = linhas.find((c) => c.page === p.page && Math.abs((c.y0 + c.y1) / 2 - (p.y0 + p.y1) / 2) < (p.y1 - p.y0) * 0.7);
    if (l) { l.x0 = Math.min(l.x0, p.x0); l.x1 = Math.max(l.x1, p.x1); l.y0 = Math.min(l.y0, p.y0); l.y1 = Math.max(l.y1, p.y1); }
    else linhas.push({ x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1, page: p.page });
  }
  return linhas;
}
