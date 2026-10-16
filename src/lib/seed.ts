import { RETENCAO_PADRAO } from "./rateio";
import type { State, Parcela } from "./store";
const today = new Date();
const d = (offsetMonths: number, day = 10) => {
  const x = new Date(today.getFullYear(), today.getMonth() + offsetMonths, day);
  return x.toISOString().slice(0, 10);
};

function parcelasExemplo(vgv: number, base: number): Parcela[] {
  const p: Parcela[] = [{ id: "p0", tipo: "Sinal/Ato", valor: vgv * 0.05, vencimento: d(base) }];
  for (let i = 1; i <= 12; i++) p.push({ id: "m" + i, tipo: "Mensal", valor: (vgv * 0.12) / 12, vencimento: d(base + i) });
  p.push({ id: "s1", tipo: "Semestral", valor: vgv * 0.04, vencimento: d(base + 6, 20) });
  p.push({ id: "s2", tipo: "Semestral", valor: vgv * 0.04, vencimento: d(base + 12, 20) });
  p.push({ id: "ch", tipo: "Chaves", valor: vgv * 0.05, vencimento: d(base + 18) });
  p.push({ id: "fgts", tipo: "FGTS", valor: vgv * 0.05, vencimento: d(base + 19) });
  p.push({ id: "fin", tipo: "Financiamento Bancário", valor: vgv * 0.65, vencimento: d(base + 19, 15) });
  return p;
}

export const seed = (): State => ({
  empreendimentos: [
    { id: "e1", nome: "Residencial Vista Mar", endereco: "Av. Atlântica, 1200 — Santos/SP", construtora: "Construtora Horizonte", honorariosPct: 5, retencao: { ...RETENCAO_PADRAO, "Sinal/Ato": 40 } },
    { id: "e2", nome: "Edifício Jardins Park", endereco: "R. Oscar Freire, 455 — São Paulo/SP", construtora: "Alfa Incorporações", honorariosPct: 4, retencao: { ...RETENCAO_PADRAO, Mensal: 40 } },
  ],
  membros: [
    { id: "m1", nome: "Rafael Jordão", apelido: "Rafa", doc: "123.456.789-00", creci: "CRECI 123456-F", telefone: "(11) 98888-1111", funcao: "Corretor" },
    { id: "m2", nome: "Juliana Costa", apelido: "Ju", doc: "234.567.890-11", creci: "CRECI 223344-F", telefone: "(11) 97777-2222", funcao: "Corretor" },
    { id: "m3", nome: "Marcos Ribeiro", apelido: "Marcão", doc: "345.678.901-22", creci: "CRECI 334455-F", telefone: "(11) 96666-3333", funcao: "Gerente" },
    { id: "m4", nome: "Helena Duarte", apelido: "Helena", doc: "456.789.012-33", creci: "CRECI 445566-F", telefone: "(11) 95555-4444", funcao: "Diretor Comercial" },
    { id: "m5", nome: "Dr. Paulo Lima", apelido: "Jurídico", doc: "567.890.123-44", creci: "OAB 112233", telefone: "(11) 94444-5555", funcao: "Jurídico" },
    { id: "m6", nome: "R&J Negócios Imobiliários", apelido: "R&J", doc: "12.345.678/0001-90", creci: "CRECI J-30000", telefone: "(11) 3333-0000", funcao: "Imobiliária" },
  ],
  propostas: [
    { id: "pr1", status: "Aprovada", empreendimentoId: "e1", unidade: "1204", torre: "A", vaga: "45", vgv: 850000, createdAt: d(-2, 5),
      compradores: [{ nome: "Carlos Mendes", cpf: "111.222.333-44", rg: "12.345.678-9", endereco: "R. das Flores, 10 — Santos/SP", conjuge: "Ana Mendes" }],
      parcelas: parcelasExemplo(850000, -2),
      participantes: [{ membroId: "m1", pct: 2 }, { membroId: "m3", pct: 1 }, { membroId: "m4", pct: 0.5 }, { membroId: "m5", pct: 0.5 }, { membroId: "m6", pct: 1 }] },
    { id: "pr2", status: "Em Análise", empreendimentoId: "e2", unidade: "803", torre: "B", vaga: "12", vgv: 1200000, createdAt: d(0, 2),
      compradores: [{ nome: "Fernanda Alves", cpf: "222.333.444-55", rg: "23.456.789-0", endereco: "Al. Santos, 800 — São Paulo/SP", conjuge: "" }],
      parcelas: parcelasExemplo(1200000, 0),
      participantes: [{ membroId: "m2", pct: 1.5 }, { membroId: "m3", pct: 1 }, { membroId: "m6", pct: 1.5 }] },
    { id: "pr3", status: "Escriturada", empreendimentoId: "e1", unidade: "502", torre: "B", vaga: "08", vgv: 640000, createdAt: d(-5, 18),
      compradores: [{ nome: "Bruno Teixeira", cpf: "333.444.555-66", rg: "34.567.890-1", endereco: "R. Goiás, 77 — Santos/SP", conjuge: "Lara Teixeira" }],
      parcelas: parcelasExemplo(640000, -5),
      participantes: [{ membroId: "m2", pct: 2.5 }, { membroId: "m3", pct: 1 }, { membroId: "m6", pct: 1.5 }] },
  ],
  envelopes: [
    { id: "env-8f21", propostaId: "pr1", status: "Assinado", link: "https://app.assinafy.com.br/sign/env-8f21", enviadoEm: d(-1) },
    { id: "env-a930", propostaId: "pr2", status: "Pendente", link: "https://app.assinafy.com.br/sign/env-a930", enviadoEm: d(0, 3) },
  ],
  usuarios: [
    { id: "u1", nome: "Samuel Cerqueira", email: "samuel@rj.com.br", papel: "Admin" },
    { id: "u2", nome: "Marcos Ribeiro", email: "marcos@rj.com.br", papel: "Gerente" },
    { id: "u3", nome: "Rafael Jordão", email: "rafael@rj.com.br", papel: "Corretor" },
  ],
  config: { assinafyToken: "", asaasToken: "", sandbox: true, webhookSecret: "whsec_rj7k2m9q4x8p" },
  webhookLog: [],
});
