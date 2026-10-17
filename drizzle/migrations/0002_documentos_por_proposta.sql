CREATE TABLE public.documentos_proposta (
 id text PRIMARY KEY,
 proposta_id text NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
 nome text NOT NULL,
 tipo text NOT NULL,
 caminho text NOT NULL UNIQUE,
 mime text NOT NULL,
 tamanho bigint NOT NULL,
 trechos jsonb NOT NULL DEFAULT '{}'::jsonb,
 rotulos jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT documento_caminho_proposta CHECK (split_part(caminho, '/', 1) = proposta_id)
);
GRANT SELECT, INSERT, DELETE ON public.documentos_proposta TO authenticated;
GRANT ALL ON public.documentos_proposta TO service_role;
ALTER TABLE public.documentos_proposta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documentos da proposta leitura" ON public.documentos_proposta FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = proposta_id AND (public.is_staff(auth.uid()) OR (public.has_any_role(auth.uid()) AND p.criado_por = auth.uid()))));
CREATE POLICY "documentos da proposta envio" ON public.documentos_proposta FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = proposta_id AND (public.is_staff(auth.uid()) OR (public.has_any_role(auth.uid()) AND p.criado_por = auth.uid()))));
CREATE POLICY "documentos da proposta exclusao" ON public.documentos_proposta FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = proposta_id AND (public.is_staff(auth.uid()) OR (public.has_any_role(auth.uid()) AND p.criado_por = auth.uid()))));
CREATE INDEX documentos_proposta_proposta_idx ON public.documentos_proposta(proposta_id);
CREATE POLICY "arquivos proposta leitura" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos-propostas' AND EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = (storage.foldername(name))[1] AND (public.is_staff(auth.uid()) OR (public.has_any_role(auth.uid()) AND p.criado_por = auth.uid()))));
CREATE POLICY "arquivos proposta envio" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos-propostas' AND EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = (storage.foldername(name))[1] AND (public.is_staff(auth.uid()) OR (public.has_any_role(auth.uid()) AND p.criado_por = auth.uid()))));
CREATE POLICY "arquivos proposta exclusao" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos-propostas' AND EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = (storage.foldername(name))[1] AND (public.is_staff(auth.uid()) OR (public.has_any_role(auth.uid()) AND p.criado_por = auth.uid()))));