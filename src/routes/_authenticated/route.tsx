import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { carregar, getState } from "@/lib/store";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    if (!getState().carregado || getState().eu?.id !== data.user.id) await carregar();
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
