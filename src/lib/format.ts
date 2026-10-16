export const brl = (n?: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (n?: number) => `${(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
export const dt = (s?: string | null) => (s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR") : "—");
export const uid = () => Math.random().toString(36).slice(2, 10);

export function download(name: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
}
