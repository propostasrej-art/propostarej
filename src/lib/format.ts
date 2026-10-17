export const brl = (n?: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (n?: number) => `${(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
export const dt = (s?: string | null) => (s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR") : "—");
export const uid = () => Math.random().toString(36).slice(2, 10);

/** Valor pronto para digitação: 1251.39 → "1251,39" (0 → vazio). */
export const moedaEdicao = (n?: number) => (n ? String(n).replace(".", ",") : "");

/** Lê um valor em Real digitado pelo usuário: "1.251,39", "R$ 12000" ou "94998," → número. */
export function parseMoedaBR(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export function download(name: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
}
