create type public.app_role as enum ('admin','gerente','corretor');

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, nome text not null default '', email text not null default '', created_at timestamptz not null default now());
grant select, update on public.profiles to authenticated; grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "perfis visiveis" on public.profiles for select to authenticated using (true);
create policy "edita proprio perfil" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role public.app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create or replace function public.is_staff(_user_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','gerente')) $$;
create or replace function public.has_any_role(_user_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id) $$;

create policy "ve proprio papel ou admin" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.convites (id text primary key, email text not null, nome text not null default '', papel public.app_role not null default 'corretor', created_at timestamptz not null default now());
create unique index convites_email_idx on public.convites (lower(email));
grant select, insert, update, delete on public.convites to authenticated; grant all on public.convites to service_role;
alter table public.convites enable row level security;
create policy "admin gerencia convites" on public.convites for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.empreendimentos (id text primary key, dados jsonb not null, updated_at timestamptz not null default now());
create table public.membros (id text primary key, dados jsonb not null, updated_at timestamptz not null default now());
create table public.propostas (id text primary key, dados jsonb not null, criado_por uuid default auth.uid(), updated_at timestamptz not null default now());
create table public.envelopes (id text primary key, proposta_id text not null references public.propostas(id) on delete cascade, dados jsonb not null, updated_at timestamptz not null default now());
create table public.config (id int primary key default 1 check (id = 1), dados jsonb not null);
create table public.webhook_log (id bigserial primary key, at timestamptz not null default now(), origem text not null default '', payload text not null default '');

grant select, insert, update, delete on public.empreendimentos, public.membros, public.propostas, public.envelopes, public.config, public.webhook_log to authenticated;
grant all on public.empreendimentos, public.membros, public.propostas, public.envelopes, public.config, public.webhook_log to service_role;
grant usage on sequence public.webhook_log_id_seq to authenticated;
alter table public.empreendimentos enable row level security;
alter table public.membros enable row level security;
alter table public.propostas enable row level security;
alter table public.envelopes enable row level security;
alter table public.config enable row level security;
alter table public.webhook_log enable row level security;

create policy "usuarios leem" on public.empreendimentos for select to authenticated using (public.has_any_role(auth.uid()));
create policy "gestao escreve" on public.empreendimentos for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "usuarios leem" on public.membros for select to authenticated using (public.has_any_role(auth.uid()));
create policy "gestao escreve" on public.membros for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "le propostas" on public.propostas for select to authenticated using (public.is_staff(auth.uid()) or criado_por = auth.uid());
create policy "cria propostas" on public.propostas for insert to authenticated with check (public.is_staff(auth.uid()) or (public.has_any_role(auth.uid()) and criado_por = auth.uid()));
create policy "edita propostas" on public.propostas for update to authenticated using (public.is_staff(auth.uid()) or criado_por = auth.uid()) with check (public.is_staff(auth.uid()) or criado_por = auth.uid());
create policy "exclui propostas" on public.propostas for delete to authenticated using (public.is_staff(auth.uid()) or criado_por = auth.uid());

create policy "envelopes da proposta" on public.envelopes for all to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.propostas p where p.id = proposta_id and p.criado_por = auth.uid()))
  with check (public.is_staff(auth.uid()) or exists (select 1 from public.propostas p where p.id = proposta_id and p.criado_por = auth.uid()));

create policy "admin config" on public.config for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin log" on public.webhook_log for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Signup: first user becomes admin; afterwards only invited e-mails may register.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare c public.convites%rowtype;
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
    insert into public.profiles(id, nome, email) values (new.id, coalesce(new.raw_user_meta_data->>'nome',''), new.email);
    return new;
  end if;
  select * into c from public.convites where lower(email) = lower(new.email);
  if not found then
    raise exception 'Cadastro restrito: este e-mail não foi convidado.';
  end if;
  insert into public.user_roles(user_id, role) values (new.id, c.papel);
  insert into public.profiles(id, nome, email) values (new.id, coalesce(nullif(c.nome,''), new.raw_user_meta_data->>'nome', ''), new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Keep roles in sync with the invite list.
create or replace function public.sync_convite_role() returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if tg_op = 'DELETE' then
    select id into uid from public.profiles where lower(email) = lower(old.email);
    if uid is not null then delete from public.user_roles where user_id = uid; end if;
    return old;
  end if;
  select id into uid from public.profiles where lower(email) = lower(new.email);
  if uid is not null then
    delete from public.user_roles where user_id = uid;
    insert into public.user_roles(user_id, role) values (uid, new.papel);
  end if;
  return new;
end $$;
create trigger convites_sync after insert or update or delete on public.convites for each row execute function public.sync_convite_role();

insert into public.empreendimentos(id,dados) values ('e1','{"id":"e1","nome":"Residencial Vista Mar","endereco":"Av. Atlântica, 1200 — Santos/SP","construtora":"Construtora Horizonte","honorariosPct":5,"retencao":{"Sinal/Ato":40,"Mensal":50,"Semestral":50,"Chaves":30,"Financiamento Bancário":0,"FGTS":0,"Subsídio":0}}'::jsonb);
insert into public.empreendimentos(id,dados) values ('e2','{"id":"e2","nome":"Edifício Jardins Park","endereco":"R. Oscar Freire, 455 — São Paulo/SP","construtora":"Alfa Incorporações","honorariosPct":4,"retencao":{"Sinal/Ato":100,"Mensal":40,"Semestral":50,"Chaves":30,"Financiamento Bancário":0,"FGTS":0,"Subsídio":0}}'::jsonb);
insert into public.membros(id,dados) values ('m1','{"id":"m1","nome":"Rafael Jordão","apelido":"Rafa","doc":"123.456.789-00","creci":"CRECI 123456-F","telefone":"(11) 98888-1111","funcao":"Corretor"}'::jsonb);
insert into public.membros(id,dados) values ('m2','{"id":"m2","nome":"Juliana Costa","apelido":"Ju","doc":"234.567.890-11","creci":"CRECI 223344-F","telefone":"(11) 97777-2222","funcao":"Corretor"}'::jsonb);
insert into public.membros(id,dados) values ('m3','{"id":"m3","nome":"Marcos Ribeiro","apelido":"Marcão","doc":"345.678.901-22","creci":"CRECI 334455-F","telefone":"(11) 96666-3333","funcao":"Gerente"}'::jsonb);
insert into public.membros(id,dados) values ('m4','{"id":"m4","nome":"Helena Duarte","apelido":"Helena","doc":"456.789.012-33","creci":"CRECI 445566-F","telefone":"(11) 95555-4444","funcao":"Diretor Comercial"}'::jsonb);
insert into public.membros(id,dados) values ('m5','{"id":"m5","nome":"Dr. Paulo Lima","apelido":"Jurídico","doc":"567.890.123-44","creci":"OAB 112233","telefone":"(11) 94444-5555","funcao":"Jurídico"}'::jsonb);
insert into public.membros(id,dados) values ('m6','{"id":"m6","nome":"R&J Negócios Imobiliários","apelido":"R&J","doc":"12.345.678/0001-90","creci":"CRECI J-30000","telefone":"(11) 3333-0000","funcao":"Imobiliária"}'::jsonb);
insert into public.propostas(id,dados,criado_por) values ('pr1','{"id":"pr1","status":"Aprovada","empreendimentoId":"e1","unidade":"1204","torre":"A","vaga":"45","vgv":850000,"createdAt":"2026-08-05","compradores":[{"nome":"Carlos Mendes","cpf":"111.222.333-44","rg":"12.345.678-9","endereco":"R. das Flores, 10 — Santos/SP","conjuge":"Ana Mendes"}],"parcelas":[{"id":"p0","tipo":"Sinal/Ato","valor":42500,"vencimento":"2026-08-10"},{"id":"m1","tipo":"Mensal","valor":8500,"vencimento":"2026-09-10"},{"id":"m2","tipo":"Mensal","valor":8500,"vencimento":"2026-10-10"},{"id":"m3","tipo":"Mensal","valor":8500,"vencimento":"2026-11-10"},{"id":"m4","tipo":"Mensal","valor":8500,"vencimento":"2026-12-10"},{"id":"m5","tipo":"Mensal","valor":8500,"vencimento":"2027-01-10"},{"id":"m6","tipo":"Mensal","valor":8500,"vencimento":"2027-02-10"},{"id":"m7","tipo":"Mensal","valor":8500,"vencimento":"2027-03-10"},{"id":"m8","tipo":"Mensal","valor":8500,"vencimento":"2027-04-10"},{"id":"m9","tipo":"Mensal","valor":8500,"vencimento":"2027-05-10"},{"id":"m10","tipo":"Mensal","valor":8500,"vencimento":"2027-06-10"},{"id":"m11","tipo":"Mensal","valor":8500,"vencimento":"2027-07-10"},{"id":"m12","tipo":"Mensal","valor":8500,"vencimento":"2027-08-10"},{"id":"s1","tipo":"Semestral","valor":34000,"vencimento":"2027-02-20"},{"id":"s2","tipo":"Semestral","valor":34000,"vencimento":"2027-08-20"},{"id":"ch","tipo":"Chaves","valor":42500,"vencimento":"2028-02-10"},{"id":"fgts","tipo":"FGTS","valor":42500,"vencimento":"2028-03-10"},{"id":"fin","tipo":"Financiamento Bancário","valor":552500,"vencimento":"2028-03-15"}],"participantes":[{"membroId":"m1","pct":2},{"membroId":"m3","pct":1},{"membroId":"m4","pct":0.5},{"membroId":"m5","pct":0.5},{"membroId":"m6","pct":1}]}'::jsonb, null);
insert into public.propostas(id,dados,criado_por) values ('pr2','{"id":"pr2","status":"Em Análise","empreendimentoId":"e2","unidade":"803","torre":"B","vaga":"12","vgv":1200000,"createdAt":"2026-10-02","compradores":[{"nome":"Fernanda Alves","cpf":"222.333.444-55","rg":"23.456.789-0","endereco":"Al. Santos, 800 — São Paulo/SP","conjuge":""}],"parcelas":[{"id":"p0","tipo":"Sinal/Ato","valor":60000,"vencimento":"2026-10-10"},{"id":"m1","tipo":"Mensal","valor":12000,"vencimento":"2026-11-10"},{"id":"m2","tipo":"Mensal","valor":12000,"vencimento":"2026-12-10"},{"id":"m3","tipo":"Mensal","valor":12000,"vencimento":"2027-01-10"},{"id":"m4","tipo":"Mensal","valor":12000,"vencimento":"2027-02-10"},{"id":"m5","tipo":"Mensal","valor":12000,"vencimento":"2027-03-10"},{"id":"m6","tipo":"Mensal","valor":12000,"vencimento":"2027-04-10"},{"id":"m7","tipo":"Mensal","valor":12000,"vencimento":"2027-05-10"},{"id":"m8","tipo":"Mensal","valor":12000,"vencimento":"2027-06-10"},{"id":"m9","tipo":"Mensal","valor":12000,"vencimento":"2027-07-10"},{"id":"m10","tipo":"Mensal","valor":12000,"vencimento":"2027-08-10"},{"id":"m11","tipo":"Mensal","valor":12000,"vencimento":"2027-09-10"},{"id":"m12","tipo":"Mensal","valor":12000,"vencimento":"2027-10-10"},{"id":"s1","tipo":"Semestral","valor":48000,"vencimento":"2027-04-20"},{"id":"s2","tipo":"Semestral","valor":48000,"vencimento":"2027-10-20"},{"id":"ch","tipo":"Chaves","valor":60000,"vencimento":"2028-04-10"},{"id":"fgts","tipo":"FGTS","valor":60000,"vencimento":"2028-05-10"},{"id":"fin","tipo":"Financiamento Bancário","valor":780000,"vencimento":"2028-05-15"}],"participantes":[{"membroId":"m2","pct":1.5},{"membroId":"m3","pct":1},{"membroId":"m6","pct":1.5}]}'::jsonb, null);
insert into public.propostas(id,dados,criado_por) values ('pr3','{"id":"pr3","status":"Escriturada","empreendimentoId":"e1","unidade":"502","torre":"B","vaga":"08","vgv":640000,"createdAt":"2026-05-18","compradores":[{"nome":"Bruno Teixeira","cpf":"333.444.555-66","rg":"34.567.890-1","endereco":"R. Goiás, 77 — Santos/SP","conjuge":"Lara Teixeira"}],"parcelas":[{"id":"p0","tipo":"Sinal/Ato","valor":32000,"vencimento":"2026-05-10"},{"id":"m1","tipo":"Mensal","valor":6400,"vencimento":"2026-06-10"},{"id":"m2","tipo":"Mensal","valor":6400,"vencimento":"2026-07-10"},{"id":"m3","tipo":"Mensal","valor":6400,"vencimento":"2026-08-10"},{"id":"m4","tipo":"Mensal","valor":6400,"vencimento":"2026-09-10"},{"id":"m5","tipo":"Mensal","valor":6400,"vencimento":"2026-10-10"},{"id":"m6","tipo":"Mensal","valor":6400,"vencimento":"2026-11-10"},{"id":"m7","tipo":"Mensal","valor":6400,"vencimento":"2026-12-10"},{"id":"m8","tipo":"Mensal","valor":6400,"vencimento":"2027-01-10"},{"id":"m9","tipo":"Mensal","valor":6400,"vencimento":"2027-02-10"},{"id":"m10","tipo":"Mensal","valor":6400,"vencimento":"2027-03-10"},{"id":"m11","tipo":"Mensal","valor":6400,"vencimento":"2027-04-10"},{"id":"m12","tipo":"Mensal","valor":6400,"vencimento":"2027-05-10"},{"id":"s1","tipo":"Semestral","valor":25600,"vencimento":"2026-11-20"},{"id":"s2","tipo":"Semestral","valor":25600,"vencimento":"2027-05-20"},{"id":"ch","tipo":"Chaves","valor":32000,"vencimento":"2027-11-10"},{"id":"fgts","tipo":"FGTS","valor":32000,"vencimento":"2027-12-10"},{"id":"fin","tipo":"Financiamento Bancário","valor":416000,"vencimento":"2027-12-15"}],"participantes":[{"membroId":"m2","pct":2.5},{"membroId":"m3","pct":1},{"membroId":"m6","pct":1.5}]}'::jsonb, null);
insert into public.envelopes(id,proposta_id,dados) values ('env-8f21','pr1','{"id":"env-8f21","propostaId":"pr1","status":"Assinado","link":"https://app.assinafy.com.br/sign/env-8f21","enviadoEm":"2026-09-10"}'::jsonb);
insert into public.envelopes(id,proposta_id,dados) values ('env-a930','pr2','{"id":"env-a930","propostaId":"pr2","status":"Pendente","link":"https://app.assinafy.com.br/sign/env-a930","enviadoEm":"2026-10-03"}'::jsonb);
insert into public.config(id,dados) values (1,'{"assinafyToken":"","asaasToken":"","sandbox":true,"webhookSecret":"whsec_rj7k2m9q4x8p"}'::jsonb);