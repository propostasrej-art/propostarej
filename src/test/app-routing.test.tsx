import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { Route as ContratoRoute } from "@/routes/_authenticated/contrato";
import { Route as PropostaRoute } from "@/routes/_authenticated/proposta";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  // O botão "Imprimir contrato" do Inbox abre /contrato com a proposta e a flag de impressão.
  it("reads the proposal and print flag from the contract URL", () => {
    const search = ContratoRoute.options.validateSearch as (s: Record<string, unknown>) => { id?: string; imprimir: boolean };

    expect(search({ id: "p1", imprimir: "true" })).toEqual({ id: "p1", imprimir: true });
    expect(search({ id: "p1", imprimir: "false" })).toEqual({ id: "p1", imprimir: false });
    expect(search({})).toEqual({ id: undefined, imprimir: false });
  });

  // O botão "Imprimir proposta" do Inbox abre /proposta com a proposta e a flag de impressão.
  it("reads the proposal and print flag from the ficha URL", () => {
    const search = PropostaRoute.options.validateSearch as (s: Record<string, unknown>) => { id?: string; imprimir: boolean };

    expect(search({ id: "p1", imprimir: "true" })).toEqual({ id: "p1", imprimir: true });
    expect(search({ id: "p1", imprimir: "false" })).toEqual({ id: "p1", imprimir: false });
    expect(search({})).toEqual({ id: undefined, imprimir: false });
  });
});
