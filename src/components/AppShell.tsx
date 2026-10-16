import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { LayoutDashboard, FileText, Calculator, Inbox, Building2, Users, Trophy, ScrollText, PenTool, Webhook, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/proposta", label: "Ficha da Proposta", icon: FileText },
  { to: "/rateio", label: "Motor de Rateio", icon: Calculator },
  { to: "/inbox", label: "Inbox de Propostas", icon: Inbox },
  { to: "/empreendimentos", label: "Empreendimentos", icon: Building2 },
  { to: "/equipe", label: "Equipe e Cargos", icon: Users },
  { to: "/ranking", label: "Ranking Comercial", icon: Trophy },
  { to: "/contrato", label: "Contrato e Minutas", icon: ScrollText },
  { to: "/assinaturas", label: "Assinatura & Cobrança", icon: PenTool },
  { to: "/webhooks", label: "Webhooks e Acesso", icon: Webhook },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const [mobile, setMobile] = useState(false);
  const path = useRouterState({ select: (r) => r.location.pathname });
  const side = (
    <nav className="flex flex-col gap-1 p-3">
      {nav.map((n) => {
        const active = path === n.to;
        return (
          <Link key={n.to} to={n.to} onClick={() => setMobile(false)} title={n.label}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent")}>
            <n.icon className="h-4 w-4 shrink-0" />
            {(open || mobile) && <span className="truncate">{n.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="flex min-h-screen w-full">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 border-r bg-sidebar transition-all md:block print:hidden", open ? "w-64" : "w-16")}>
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground">R&J</div>
          {open && <div className="leading-tight"><div className="text-sm font-bold">Analista de Cadastro</div><div className="text-xs text-muted-foreground">R&J Imobiliária</div></div>}
        </div>
        {side}
      </aside>
      {mobile && (
        <div className="fixed inset-0 z-40 md:hidden print:hidden" onClick={() => setMobile(false)}>
          <div className="absolute inset-0 bg-foreground/30" />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar" onClick={(e) => e.stopPropagation()}>{side}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur print:hidden">
          <button className="rounded-md p-2 hover:bg-muted" aria-label="Alternar menu"
            onClick={() => (window.innerWidth < 768 ? setMobile(true) : setOpen(!open))}>
            {open ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
          </button>
          <span className="text-sm text-muted-foreground">Gestão de Propostas · Análise Documental · Rateio de Comissões</span>
        </header>
        <main className="flex-1 p-4 md:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
