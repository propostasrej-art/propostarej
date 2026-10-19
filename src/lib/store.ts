import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Modalidade, Retencao, TipoParcela } from "./rateio";
import type { TipoParcelaCadastro } from "./tipos-parcela";

export type Status = "Em Análise" | "Aprovada" | "Escriturada";
export type Funcao = "Corretor" | "Gerente" | "Diretor Comercial" | "Jurídico" | "Imobiliária";
export interface Comprador { nome: string; cpf: string; rg: string; endereco: string; conjuge: string; nascimento?: string; estadoCivil?: string; profissao?: string; nacionalidade?: string; email?: string; telefone?: string }
export interface Parcela { id: string; tipo: TipoParcela; valor: number; vencimento: string }
export interface Participacao { membroId: string; pct: number; atoFull?: boolean; ocultar?: boolean; cargo?: string; premio?: number; proporcao?: number }
export interface Proposta {
  id: string; status: Status; empreendimentoId: string; unidade: string; torre: string; vaga: string; vgv: number;
  compradores: Comprador[]; parcelas: Parcela[]; participantes: Participacao[]; createdAt: string; modalidade?: Modalidade; taxaComissao?: number | undefined; pctPorCargo?: Partial<Record<string, number>>;
}
export interface Empreendimento { id: string; nome: string; endereco: string; construtora: string; honorariosPct: number; retencao: Retencao }
export interface Membro { id: string; nome: string; apelido: string; doc: string; creci: string; telefone: string; email?: string; funcao: Funcao }
export type EnvStatus = "Pendente" | "Assinado" | "Rejeitado" | "Não Encontrado";
export interface Envelope { id: string; propostaId: string; status: EnvStatus; link: string; enviadoEm: string }
export type Papel = "Admin" | "Gerente" | "Corretor";
/** Convite de acesso: só e-mails desta lista conseguem criar conta. */
export interface Usuario { id: string; nome: string; email: string; papel: Papel }
export interface Config { assinafyToken: string; asaasToken: string; sandbox: boolean; webhookSecret: string }
export interface Eu { id: string; email: string; papel: Papel | null }
export interface State {
  propostas: Proposta[]; empreendimentos: Empreendimento[]; membros: Membro[]; envelopes: Envelope[];
  usuarios: Usuario[]; config: Config; webhookLog: { at: string; origem: string; payload: string }[];
  eu: Eu | null; carregado: boolean; tiposParcela: TipoParcelaCadastro[];
}

const CONFIG_PADRAO: Config = { assinafyToken: "", asaasToken: "", sandbox: true, webhookSecret: "" };
const vazio = (): State => ({ propostas: [], empreendimentos: [], membros: [], envelopes: [], usuarios: [], config: CONFIG_PADRAO, webhookLog: [], eu: null, carregado: false, tiposParcela: [] });
const toPapel = (r: string | null | undefined): Papel | null => (r === "admin" ? "Admin" : r === "gerente" ? "Gerente" : r === "corretor" ? "Corretor" : null);
const fromPapel = (p: Papel) => p.toLowerCase() as "admin" | "gerente" | "corretor";

let state: State = vazio();
const SERVER = vazio();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Carrega todos os dados visíveis ao usuário logado (as regras de acesso ficam no banco). */
export async function carregar() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) { state = { ...vazio(), carregado: true }; emit(); return; }
  const [roles, emp, mem, pro, env, conv, cfg, log, tipos] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    supabase.from("empreendimentos").select("dados").order("id"),
    supabase.from("membros").select("dados").order("id"),
    supabase.from("propostas").select("dados").order("updated_at"),
    supabase.from("envelopes").select("dados").order("updated_at"),
    supabase.from("convites").select("id,email,nome,papel").order("created_at"),
    supabase.from("config").select("dados").eq("id", 1).maybeSingle(),
    supabase.from("webhook_log").select("at,origem,payload").order("at", { ascending: false }).limit(20),
    supabase.from("tipos_parcela").select("id,nome").order("created_at"),
  ]);
  const ordem = ["admin", "gerente", "corretor"];
  const role = (roles.data ?? []).map((r) => r.role).sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))[0];
  state = {
    eu: { id: u.user.id, email: u.user.email ?? "", papel: toPapel(role) },
    empreendimentos: (emp.data ?? []).map((r) => r.dados as unknown as Empreendimento),
    membros: (mem.data ?? []).map((r) => r.dados as unknown as Membro),
    propostas: (pro.data ?? []).map((r) => r.dados as unknown as Proposta),
    envelopes: (env.data ?? []).map((r) => r.dados as unknown as Envelope),
    usuarios: (conv.data ?? []).map((r) => ({ id: r.id, email: r.email, nome: r.nome, papel: toPapel(r.papel) ?? "Corretor" })),
    config: { ...CONFIG_PADRAO, ...((cfg.data?.dados as unknown as Config) ?? {}) },
    webhookLog: log.data ?? [],
    carregado: true,
    tiposParcela: tipos.data ?? [],
  };
  emit();
}
export function limpar() { state = vazio(); emit(); }

type Tabela = "empreendimentos" | "membros" | "propostas" | "envelopes";
function diff<T extends { id: string }>(a: T[], b: T[]) {
  const antes = new Map(a.map((x) => [x.id, JSON.stringify(x)]));
  const ids = new Set(b.map((x) => x.id));
  return { upserts: b.filter((x) => antes.get(x.id) !== JSON.stringify(x)), removidos: a.filter((x) => !ids.has(x.id)).map((x) => x.id) };
}

async function persistir(prev: State, next: State) {
  const ops: PromiseLike<{ error: unknown }>[] = [];
  const agora = new Date().toISOString();
  const col = <T extends { id: string }>(t: Tabela, a: T[], b: T[], extra: (x: T) => Record<string, unknown> = () => ({})) => {
    if (a === b) return;
    const { upserts, removidos } = diff(a, b);
    if (upserts.length) ops.push(supabase.from(t).upsert(upserts.map((x) => ({ id: x.id, dados: x as never, updated_at: agora, ...extra(x) })) as never));
    if (removidos.length) ops.push(supabase.from(t).delete().in("id", removidos));
  };
  col("empreendimentos", prev.empreendimentos, next.empreendimentos);
  col("membros", prev.membros, next.membros);
  col("propostas", prev.propostas, next.propostas);
  col("envelopes", prev.envelopes, next.envelopes, (e) => ({ proposta_id: e.propostaId }));
  if (prev.usuarios !== next.usuarios) {
    const { upserts, removidos } = diff(prev.usuarios, next.usuarios);
    if (upserts.length) ops.push(supabase.from("convites").upsert(upserts.map((u) => ({ id: u.id, email: u.email.trim().toLowerCase(), nome: u.nome, papel: fromPapel(u.papel) }))));
    if (removidos.length) ops.push(supabase.from("convites").delete().in("id", removidos));
  }
  if (prev.config !== next.config) ops.push(supabase.from("config").upsert({ id: 1, dados: next.config as never }));
  if (prev.webhookLog !== next.webhookLog) {
    const novos = next.webhookLog.filter((l) => !prev.webhookLog.includes(l));
    if (novos.length) ops.push(supabase.from("webhook_log").insert(novos));
  }
  const res = await Promise.all(ops);
  const erro = res.find((r) => r.error);
  if (erro) {
    console.error(erro.error);
    toast.error("Não foi possível salvar na nuvem. Verifique sua permissão de acesso.");
    await carregar();
    return false;
  }
  return true;
}

export function setState(fn: (s: State) => State) {
  const prev = state;
  state = fn(prev);
  emit();
  return persistir(prev, state);
}
export function useStore<T>(sel: (s: State) => T): T {
  return sel(useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => SERVER));
}
export const getState = () => state;
