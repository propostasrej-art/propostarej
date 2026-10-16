import { useEffect, useMemo, useState } from "react";
import { Loader2, FileSearch } from "lucide-react";
import { localizar, type Caixa, type Palavra } from "@/lib/trechos";
import { cn } from "@/lib/utils";

interface Pagina { src: string; w: number; h: number }

async function renderizar(file: File): Promise<Pagina[]> {
  if (file.type.startsWith("image/")) {
    const src = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = src; });
    return [{ src, w: img.naturalWidth, h: img.naturalHeight }];
  }
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: Pagina[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
    out.push({ src: canvas.toDataURL("image/png"), w: vp.width, h: vp.height });
  }
  return out;
}

type W = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } };
function coletarPalavras(data: unknown): W[] {
  const d = data as { words?: W[]; blocks?: { paragraphs: { lines: { words: W[] }[] }[] }[] };
  if (d.words?.length) return d.words;
  return (d.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
}

export function DocViewer({ file, trechos, ativo, onPick, rotulos }: {
  file: File; trechos: Record<string, string>; ativo: string | null; onPick: (k: string) => void; rotulos: Record<string, string>;
}) {
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [palavras, setPalavras] = useState<Palavra[]>([]);
  const [status, setStatus] = useState("Carregando documento...");

  useEffect(() => {
    let vivo = true;
    setPaginas([]); setPalavras([]); setStatus("Carregando documento...");
    (async () => {
      try {
        const pgs = await renderizar(file);
        if (!vivo) return;
        setPaginas(pgs); setStatus("Localizando trechos no documento...");
        const { createWorker } = await import("tesseract.js");
        const w = await createWorker("por");
        const all: Palavra[] = [];
        for (let i = 0; i < pgs.length; i++) {
          const { data } = await w.recognize(pgs[i]!.src, {}, { blocks: true });
          coletarPalavras(data).forEach((x) => all.push({ text: x.text, ...x.bbox, page: i }));
        }
        await w.terminate();
        if (vivo) { setPalavras(all); setStatus(""); }
      } catch {
        if (vivo) setStatus("Não foi possível localizar os trechos neste documento.");
      }
    })();
    return () => { vivo = false; };
  }, [file]);

  const caixas = useMemo(() => {
    const m: Record<string, Caixa[]> = {};
    if (!palavras.length) return m;
    Object.entries(trechos).forEach(([k, t]) => { const c = localizar(t, palavras); if (c.length) m[k] = c; });
    return m;
  }, [trechos, palavras]);

  useEffect(() => {
    const c = ativo && caixas[ativo]?.[0];
    if (c) document.getElementById(`doc-box-${ativo}-0`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [ativo, caixas]);

  const trechoAtivo = ativo ? trechos[ativo] : undefined;
  const achados = Object.keys(caixas).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate font-medium text-foreground">{file.name}</span>
        {status ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{status}</span>
          : <span><span className="font-mono">{achados}</span> de <span className="font-mono">{Object.keys(trechos).length}</span> trechos localizados</span>}
      </div>
      <div className="rounded-lg border bg-muted/40 p-3 text-xs">
        {ativo ? (
          <><div className="font-semibold text-foreground">{rotulos[ativo] ?? ativo}</div>
            <div className="mt-1 font-mono text-muted-foreground">{trechoAtivo ? `“${trechoAtivo}”` : "Sem trecho de origem informado."}</div>
            {trechoAtivo && !status && !caixas[ativo] && <div className="mt-1 text-warn-foreground">Trecho não localizado visualmente no documento.</div>}</>
        ) : <div className="flex items-center gap-2 text-muted-foreground"><FileSearch className="h-4 w-4" />Clique em um campo da ficha ou em um destaque do documento.</div>}
      </div>
      <div className="max-h-[75vh] space-y-3 overflow-auto rounded-lg border bg-muted p-2">
        {paginas.map((pg, i) => (
          <div key={i} className="relative w-full overflow-hidden rounded bg-card shadow-sm">
            <img src={pg.src} alt={`Página ${i + 1}`} className="block w-full" />
            {Object.entries(caixas).flatMap(([k, cs]) => cs.map((c, j) => c.page === i && (
              <button key={`${k}-${j}`} id={`doc-box-${k}-${j}`} type="button" title={rotulos[k] ?? k} onClick={() => onPick(k)}
                className={cn("absolute rounded-sm border transition-all",
                  k === ativo ? "z-10 border-primary bg-primary/25 ring-2 ring-primary/50" : "border-primary/30 bg-primary/10 hover:bg-primary/20")}
                style={{ left: `${(c.x0 / pg.w) * 100 - 0.3}%`, top: `${(c.y0 / pg.h) * 100 - 0.3}%`, width: `${((c.x1 - c.x0) / pg.w) * 100 + 0.6}%`, height: `${((c.y1 - c.y0) / pg.h) * 100 + 0.6}%` }} />
            )))}
          </div>
        ))}
        {!paginas.length && <div className="grid h-60 place-items-center text-xs text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      </div>
    </div>
  );
}
