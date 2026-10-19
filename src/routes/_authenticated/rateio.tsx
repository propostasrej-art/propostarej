import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, CalendarDays, Printer, ShieldCheck, Trash2, Plus } from "lucide-react";
import { Btn, Card, Field, Input, Mono, PageHeader, Select, Td, Th } from "@/components/kit";
import { PropostaPicker } from "@/components/PropostaPicker";
import { CredenciaisTable } from "@/components/CredenciaisTable";
import { MembroPicker } from "@/components/MembroPicker";
import { setState, useStore } from "@/lib/store";
import { ehProtegida, MODALIDADES, NOME_TIER, type Modalidade } from "@/lib/rateio";
import { nomesTiposParcela } from "@/lib/tipos-parcela";
import { brl, download, dt, pct } from "@/lib/format";
import { comissaoPct, meta, rateioDaProposta } from "@/lib/helpers";

export const Route = createFileRoute("/_authenticated/rateio")({
  head: () => meta("Motor de Rateio", "Rateio em cascata de comissões com capping dinâmico."),
  component: Rateio,
});

function Rateio() {
  const s = useStore((x) => x);
  const [id, setId] = useState(s.propostas[0]?.id ?? "");
  const found = s.propostas.find((x) => x.id === id) ?? s.propostas[0];
  if (!found) return <PageHeader title="Motor de Rateio" subtitle="Cadastre uma proposta primeiro." />;
  const p = found;
  const { emp, parts, res } = rateioDaProposta(s, p);
  const membros = p.participantes.map((x) => s.membros.find((m) => m.id === x.membroId)!).filter(Boolean);
  const eventosComissao = res.eventos.filter((e) => e.pool > 0);

  const upP = (patch: Partial<typeof p>) => setState((st) => ({ ...st, propostas: st.propostas.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));
  const keyDe = (y: (typeof p.participantes)[number]) => (y.cargo?.trim() || s.membros.find((mm) => mm.id === y.membroId)?.funcao || "") as string;
  // A Comissão informada é a % total do cargo, dividida igualmente entre os participantes dele.
  const setPctCargo = (i: number, v: number) => {
    const key = keyDe(p.participantes[i]!);
    if (!key) { upP({ participantes: p.participantes.map((z, j) => (j === i ? { ...z, pct: v } : z)) }); return; }
    const grupo = p.participantes.filter((z) => keyDe(z) === key);
    upP({
      participantes: p.participantes.map((z) => (grupo.includes(z) ? { ...z, pct: v / grupo.length } : z)),
      pctPorCargo: { ...p.pctPorCargo, [key]: v },
    });
  };
  const setCargo = (i: number, v: string) => {
    const y = p.participantes[i]!;
    const oldKey = keyDe(y);
    let partes = p.participantes.map((z, j) => (j === i ? { ...z, cargo: v } : z));
    const pctPor = { ...(p.pctPorCargo ?? {}) };
    const repartir = (key: string, total: number, grupo: typeof partes) => {
      partes = partes.map((z) => (grupo.includes(z) ? { ...z, pct: total / grupo.length } : z));
      pctPor[key] = total;
    };
    if (oldKey) {
      const rest = partes.filter((z) => keyDe(z) === oldKey);
      if (rest.length) {
        const soma = rest.reduce((a, z) => a + z.pct, 0) + (v.trim() === oldKey ? 0 : y.pct);
        repartir(oldKey, pctPor[oldKey] ?? soma, rest);
      } else delete pctPor[oldKey];
    }
    const novo = v.trim();
    if (novo) {
      const grupo = partes.filter((z) => keyDe(z) === novo);
      repartir(novo, pctPor[novo] ?? grupo.reduce((a, z) => a + z.pct, 0), grupo);
    }
    upP({ participantes: partes, pctPorCargo: pctPor });
  };
  const addAoCargo = (i: number) => {
    const y = p.participantes[i]!;
    const key = keyDe(y);
    if (!key) { upP({ participantes: [...p.participantes, { membroId: "", pct: 1 }] }); return; }
    const grupo = p.participantes.filter((z) => keyDe(z) === key);
    const total = p.pctPorCargo?.[key] ?? grupo.reduce((a, z) => a + z.pct, 0);
    const n = grupo.length + 1;
    const partes = p.participantes.map((z) => (grupo.includes(z) ? { ...z, pct: total / n } : z));
    upP({
      participantes: [...partes.slice(0, i + 1), { membroId: "", pct: total / n, cargo: key }, ...partes.slice(i + 1)],
      pctPorCargo: { ...p.pctPorCargo, [key]: total },
    });
  };
  const remPart = (i: number) => {
    const y = p.participantes[i]!;
    const key = keyDe(y);
    const restantes = p.participantes.filter((_, j) => j !== i);
    if (!key) { upP({ participantes: restantes }); return; }
    const grupo = restantes.filter((z) => keyDe(z) === key);
    const pctPor = { ...(p.pctPorCargo ?? {}) };
    if (grupo.length) {
      const total = pctPor[key] ?? grupo.reduce((a, z) => a + z.pct, 0) + y.pct;
      upP({
        participantes: restantes.map((z) => (grupo.includes(z) ? { ...z, pct: total / grupo.length } : z)),
        pctPorCargo: { ...pctPor, [key]: total },
      });
    } else {
      delete pctPor[key];
      upP({ participantes: restantes, pctPorCargo: pctPor });
    }
  };
  const setModalidade = (v: Modalidade) =>
    setState((st) => ({ ...st, propostas: st.propostas.map((x) => (x.id === p.id ? { ...x, modalidade: v } : x)) }));
  const nomeDe = (id: string) => parts.find((x) => x.id === id)?.nome ?? id;
  const setRet = (tipo: string, v: number) =>
    emp && setState((st) => ({ ...st, empreendimentos: st.empreendimentos.map((e) => (e.id === emp.id ? { ...e, retencao: { ...e.retencao, [tipo]: v } } : e)) }));

  function csv() {
    const head = ["Vencimento", "Tipo", "Valor", "Comissão", ...parts.map((x) => x.nome), "Fluxo Incorporador"];
    const rows = res.eventos.map((e) => [e.parcela.vencimento, e.parcela.tipo, e.parcela.valor.toFixed(2), e.pool.toFixed(2), ...parts.map((x) => (e.pagamentos[x.id] ?? 0).toFixed(2)), e.liquidaFluxo.toFixed(2)]);
    download(`rateio-${p.unidade}.csv`, [head, ...rows].map((r) => r.join(";")).join("\n"), "text/csv");
  }
  function ics() {
    const ev = eventosComissao.map((e) => `BEGIN:VEVENT\nUID:${e.parcela.id}-${p.id}@rj\nDTSTART;VALUE=DATE:${e.parcela.vencimento.replace(/-/g, "")}\nSUMMARY:Comissão ${brl(e.pool)} — ${e.parcela.tipo} Un.${p.unidade}\nEND:VEVENT`).join("\n");
    download(`rateio-${p.unidade}.ics`, `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//RJ//Rateio//PT\n${ev}\nEND:VCALENDAR`, "text/calendar");
  }

  return (
    <div>
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <PageHeader title="Motor de Rateio em Cascata" subtitle="Cálculo cronológico do passivo de comissão, parcela a parcela"
        actions={<><PropostaPicker value={p.id} onChange={setId} />
          <Select aria-label="Modalidade de liquidação" className="w-56" value={res.modalidade} onChange={(e) => setModalidade(e.target.value as Modalidade)}>{MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</Select>
          <Btn variant="outline" onClick={csv}><Download className="h-4 w-4" />CSV</Btn>
          <Btn variant="outline" onClick={ics}><CalendarDays className="h-4 w-4" />.ics</Btn>
          <Btn onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir A4</Btn></>} />
      <div className="hidden print:block mb-4"><h1 className="text-xl font-bold">Rateio de Comissões — {emp?.nome} · Unidade {p.unidade}</h1></div>

      <div className="grid gap-6 lg:grid-cols-3 print:hidden">
        <Card title="Alíquotas" className="lg:col-span-3">
          <div className="overflow-x-auto"><table className="w-full"><thead><tr><Th>Cargo</Th><Th>Apelido</Th><Th className="text-right">Comissão (% VGV do cargo)</Th><Th className="text-right">Prêmio (% VGV)</Th><Th className="text-right">Proporção (% parcela)</Th><Th></Th></tr></thead><tbody>
            {p.participantes.map((y, i) => {
              const m = s.membros.find((mm) => mm.id === y.membroId);
              const x = parts.find((pp) => pp.id === y.membroId);
              const upI = (patch: Partial<typeof y>) => upP({ participantes: p.participantes.map((z, j) => (j === i ? { ...z, ...patch } : z)) });
              const num = (v: string) => (v === "" ? undefined : +v);
              const key = keyDe(y);
              const grupo = p.participantes.filter((z) => keyDe(z) === key);
              const cargoTotal = key ? (p.pctPorCargo?.[key] ?? grupo.reduce((a, z) => a + z.pct, 0)) : y.pct;
              return <tr key={i} className="align-top">
                <Td><Input aria-label="Cargo" className="h-9 w-44" placeholder={m?.funcao ?? "Cargo"} value={y.cargo ?? ""} onChange={(e) => setCargo(i, e.target.value)} /></Td>
                <Td><div className="w-64"><MembroPicker membros={s.membros} value={y.membroId} onChange={(id) => upI({ membroId: id })} invalid={!m} /></div>
                  {x && <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={x.atoFull} onChange={(e) => upI({ atoFull: e.target.checked })} />Ato integral</label>
                    {x.funcao !== "Imobiliária" && <label className="flex items-center gap-1"><input type="checkbox" checked={x.ocultar} onChange={(e) => upI({ ocultar: e.target.checked })} />Ocultar no contrato</label>}
                  </div>}</Td>
                <Td className="text-right"><Input type="number" step="0.01" aria-label="Comissão" className="ml-auto h-9 w-24 text-right font-mono" value={cargoTotal} onChange={(e) => setPctCargo(i, +e.target.value)} />
                  {key && grupo.length > 1 && <div className="text-xs text-muted-foreground">total do cargo ÷ {grupo.length}</div>}
                  {x && <div className="text-xs text-muted-foreground">efetiva <Mono>{pct(x.pct)}</Mono> · <Mono className="text-success">{brl(res.tetos[x.id])}</Mono></div>}</Td>
                <Td className="text-right"><Input type="number" step="0.01" aria-label="Prêmio" className="ml-auto h-9 w-24 text-right font-mono" value={y.premio ?? ""} onChange={(e) => upI({ premio: num(e.target.value) })} />
                  {y.premio != null && <div className="text-xs text-muted-foreground"><Mono className="text-success">{brl((p.vgv * y.premio) / 100)}</Mono></div>}</Td>
                <Td className="text-right"><Input type="number" step="0.01" aria-label="Proporção" className="ml-auto h-9 w-24 text-right font-mono" value={y.proporcao ?? ""} onChange={(e) => upI({ proporcao: num(e.target.value) })} /></Td>
                <Td className="whitespace-nowrap"><Btn variant="ghost" aria-label="Adicionar participante ao cargo" title="Adicionar participante ao cargo" onClick={() => addAoCargo(i)}><Plus className="h-4 w-4" /></Btn><Btn variant="ghost" aria-label="Remover participante" onClick={() => remPart(i)}><Trash2 className="h-4 w-4" /></Btn></Td>
              </tr>;
            })}
          </tbody></table></div>
          <Btn variant="outline" className="mt-2" onClick={() => upP({ participantes: [...p.participantes, { membroId: "", pct: 1 }] })}><Plus className="h-4 w-4" />Adicionar participante sem cargo</Btn>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-t pt-3">
            <Field label="Taxa da proposta (%) — vazio usa a soma"><Input type="number" step="0.1" className="w-40 font-mono" value={p.taxaComissao ?? ""} onChange={(e) => upP({ taxaComissao: e.target.value === "" ? undefined : +e.target.value })} /></Field>
            <div className="text-sm">Comissão global: <Mono className="font-semibold text-success">{pct(comissaoPct(p))}</Mono> = <Mono className="text-success">{brl(res.totalComissao)}</Mono></div>
          </div>
        </Card>
        <Card title={`Retenção por parcela — ${emp?.nome ?? ""}`} className="lg:col-span-3">
          <div className="grid gap-3 sm:grid-cols-4">{nomesTiposParcela(s.tiposParcela, p.parcelas.map((parcela) => parcela.tipo)).map((t) => {
            const prot = ehProtegida(t);
            return <Field key={t} label={`${t}${prot ? " 🔒" : ""}`}><Input type="number" disabled={prot} className="font-mono" value={prot ? 0 : emp?.retencao[t] ?? 0} onChange={(e) => setRet(t, +e.target.value)} /></Field>;
          })}</div>
          <p className="mt-3 text-xs text-muted-foreground">Financiamento Bancário, FGTS, Subsídio, parcelas do incorporador e prêmios/bonificações são protegidas e nunca deduzem comissão.{res.modalidade === "repasse" && " Em NF/Repasse a comissão inteira é quitada num único evento, no Financiamento Bancário."}</p>
        </Card>
      </div>

      <Card title="Tetos e situação por participante" className="mt-6">
        <div className="overflow-x-auto"><table className="w-full"><thead><tr><Th>Participante</Th><Th>%</Th><Th>Teto nominal</Th><Th>Recebido</Th><Th>Saldo</Th><Th>Quitação</Th></tr></thead><tbody>
          {parts.map((x) => (<tr key={x.id}><Td className="font-medium">{x.nome}</Td><Td><Mono>{pct(x.pct)}</Mono></Td><Td><Mono>{brl(res.tetos[x.id])}</Mono></Td>
            <Td><Mono className="text-success">{brl(res.pagos[x.id])}</Mono></Td><Td><Mono>{brl((res.tetos[x.id] ?? 0) - (res.pagos[x.id] ?? 0))}</Mono></Td><Td><Mono>{dt(res.quitacao[x.id])}</Mono></Td></tr>))}
        </tbody></table></div>
      </Card>

      <Card title="Cronograma de rateio (evento a evento)" className="mt-6">
        <div className="overflow-x-auto"><table className="w-full"><thead><tr><Th>Vencimento</Th><Th>Tipo</Th><Th>Parcela</Th><Th>Comissão</Th>{parts.map((x) => <Th key={x.id}>{x.nome.split(" ")[0] ?? x.nome}</Th>)}<Th>Acumulado</Th><Th>Fluxo incorporador</Th></tr></thead><tbody>
          {eventosComissao.map((e) => (<tr key={e.parcela.id} className={ehProtegida(e.parcela.tipo) ? "bg-muted/50" : ""}>
            <Td><Mono>{dt(e.parcela.vencimento)}</Mono></Td><Td>{e.parcela.tipo}</Td><Td><Mono>{brl(e.parcela.valor)}</Mono></Td><Td><Mono className="text-success">{brl(e.pool)}</Mono></Td>
            {parts.map((x) => <Td key={x.id}><Mono>{e.pagamentos[x.id] ? brl(e.pagamentos[x.id]) : "—"}</Mono></Td>)}
            <Td><Mono>{brl(e.acumuladoTotal)}</Mono></Td><Td><Mono>{brl(e.liquidaFluxo)}</Mono></Td></tr>))}
        </tbody></table></div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Credenciais dos Participantes na Venda (Rateio)"><div className="overflow-x-auto"><CredenciaisTable membros={membros} /></div></Card>
        <Card title="Diagnóstico do Especialista">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-primary"><ShieldCheck className="h-4 w-4" />Memória de cálculo</div>
            <p>Comissão total = VGV <Mono>{brl(p.vgv)}</Mono> × <Mono>{pct(comissaoPct(p))}</Mono> = <Mono className="text-success">{brl(res.totalComissao)}</Mono>.</p>
            <p>Foram processadas <Mono>{res.eventos.length}</Mono> parcelas; <Mono>{eventosComissao.length}</Mono> geraram dedução de comissão e <Mono>{res.eventos.filter((e) => ehProtegida(e.parcela.tipo)).length}</Mono> são protegidas.</p>
            <ul className="list-disc pl-5">{parts.map((x) => <li key={x.id}>{x.nome}: teto <Mono>{brl(res.tetos[x.id])}</Mono>, quitado em <Mono>{dt(res.quitacao[x.id])}</Mono></li>)}</ul>
            <div className="font-semibold">Marcos de capping</div>
            <ul className="list-disc pl-5">{res.eventos.flatMap((e) => e.capados.map((id) => <li key={e.parcela.id + id}>{nomeDe(id)} atingiu 100% do teto em <Mono>{dt(e.parcela.vencimento)}</Mono> ({e.parcela.tipo})</li>))}</ul>
            <div className="font-semibold">Rota de transbordo</div>
            {res.eventos.some((e) => e.transbordo.length) ? <ul className="list-disc pl-5">{res.eventos.filter((e) => e.transbordo.length).map((e) => <li key={e.parcela.id}><Mono>{dt(e.parcela.vencimento)}</Mono>: {e.transbordo.map((t) => <span key={t.tier}>{NOME_TIER[t.tier]} absorveu <Mono>{brl(t.valor)}</Mono>; </span>)}</li>)}</ul> : <p className="text-muted-foreground">Nenhuma sobra precisou ser roteada entre tiers.</p>}
            <p>Conferência: soma dos repasses <Mono>{brl(Object.values(res.pagos).reduce((a, b) => a + b, 0))}</Mono> + saldo pendente <Mono>{brl(res.saldoPendente)}</Mono> = passivo <Mono>{brl(res.totalComissao)}</Mono>.</p>
            <div className={`rounded-lg p-3 font-medium ${res.liberacao ? "bg-success/10 text-success" : "bg-warn/15 text-warn-foreground"}`}>
              {res.liberacao ? <>Fluxo integral liberado ao incorporador a partir de <Mono>{dt(res.liberacao)}</Mono>.</> : <>Saldo pendente de <Mono>{brl(res.saldoPendente)}</Mono>: as parcelas não-protegidas não cobrem toda a comissão.</>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
