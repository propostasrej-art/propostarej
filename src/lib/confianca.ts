/** Campos extraídos abaixo deste limiar exigem revisão humana antes de salvar. */
export const LIMIAR_REVISAO = 0.8;
export type Nivel = "alta" | "media" | "baixa";
export function nivel(c: number): Nivel {
  if (c >= LIMIAR_REVISAO) return "alta";
  if (c >= 0.5) return "media";
  return "baixa";
}
export const precisaRevisao = (c: number | undefined) => c !== undefined && c < LIMIAR_REVISAO;
export const pendentes = (conf: Record<string, number>) => Object.entries(conf).filter(([, c]) => precisaRevisao(c)).map(([k]) => k);
