import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Btn({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" | "danger" }) {
  const v = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border bg-card hover:bg-muted",
    ghost: "hover:bg-muted",
    danger: "text-destructive hover:bg-destructive/10",
  }[variant];
  return <button {...p} className={cn("inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50", v, className)} />;
}
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(inputCls, className)} />;
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(inputCls, className)} />;
export function Pill({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warn" | "danger" | "muted" }) {
  const t = { info: "bg-info/10 text-info", success: "bg-success/10 text-success", warn: "bg-warn/15 text-warn-foreground", danger: "bg-destructive/10 text-destructive", muted: "bg-muted text-muted-foreground" }[tone];
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", t)}>{children}</span>;
}
export const Mono = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cn("font-mono tabular-nums", className)}>{children}</span>;
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b px-3 py-2 text-sm", className)}>{children}</td>;
}
export const statusTone = (s: string) => (s === "Aprovada" || s === "Assinado" ? "success" : s === "Escriturada" ? "info" : s === "Rejeitado" ? "danger" : s === "Não Encontrado" ? "muted" : "warn");
