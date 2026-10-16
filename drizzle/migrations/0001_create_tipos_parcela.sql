CREATE TABLE public.tipos_parcela (
  id text PRIMARY KEY,
  nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.tipos_parcela TO authenticated;
GRANT ALL ON public.tipos_parcela TO service_role;
ALTER TABLE public.tipos_parcela ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX tipos_parcela_nome_unique ON public.tipos_parcela (lower(trim(nome)));
CREATE POLICY "usuarios leem tipos" ON public.tipos_parcela FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "admin cria tipos" ON public.tipos_parcela FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE FUNCTION public.validar_tipo_parcela() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.nome := trim(NEW.nome);
  IF lower(NEW.nome) = ANY(ARRAY['sinal/ato', 'mensal', 'semestral', 'chaves', 'financiamento bancário', 'fgts', 'subsídio']) THEN
    RAISE EXCEPTION 'Tipo de parcela já existe';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_tipo_parcela BEFORE INSERT OR UPDATE ON public.tipos_parcela FOR EACH ROW EXECUTE FUNCTION public.validar_tipo_parcela();