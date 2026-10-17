// Monta um único PDF: ficha da proposta (capturada da versão A4) + todos os documentos anexados.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4: [number, number] = [595.28, 841.89];

async function capturarFicha(el: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;padding:38px;background:#fff;";
  const clone = el.cloneNode(true) as HTMLElement;
  clone.classList.remove("hidden");
  clone.style.display = "block";
  box.appendChild(clone);
  document.body.appendChild(box);
  try {
    await Promise.all([...box.querySelectorAll("img")].map((i) => i.decode().catch(() => undefined)));
    return await html2canvas(box, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  } finally { box.remove(); }
}

async function paraPng(file: Blob): Promise<Uint8Array> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    const b = await new Promise<Blob>((r) => c.toBlob((x) => r(x!), "image/png"));
    return new Uint8Array(await b.arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
}

// As fontes padrão do PDF só aceitam o alfabeto ocidental; troca o resto por "?".
const seguro = (t: string) => t.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");

async function paginaAviso(pdf: PDFDocument, titulo: string, linhas: string[]) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage(A4); let y = A4[1] - 50;
  page.drawText(seguro(titulo), { x: 40, y, size: 12, font: bold, color: rgb(0.12, 0.23, 0.37) }); y -= 24;
  for (const bruta of linhas) {
    const palavras = seguro(bruta).split(" "); let linha = "";
    const escreve = () => { if (y < 40) { page = pdf.addPage(A4); y = A4[1] - 50; } page.drawText(linha, { x: 40, y, size: 9, font }); y -= 12; linha = ""; };
    for (const w of palavras) { if (font.widthOfTextAtSize(`${linha} ${w}`, 9) > 515 && linha) escreve(); linha = linha ? `${linha} ${w}` : w; }
    escreve();
  }
}

export type ArquivoDossie = { nome: string; tipo: string; file: Blob };

export async function gerarDossie(ficha: HTMLElement, arquivos: ArquivoDossie[]): Promise<{ blob: Blob; falhas: string[] }> {
  const pdf = await PDFDocument.create();
  const canvas = await capturarFicha(ficha);
  // Fatia a captura em folhas A4 se a ficha passar de uma página.
  const alturaFolha = Math.floor(canvas.width * (A4[1] / A4[0]));
  for (let topo = 0; topo < canvas.height; topo += alturaFolha) {
    const h = Math.min(alturaFolha, canvas.height - topo);
    const parte = document.createElement("canvas"); parte.width = canvas.width; parte.height = h;
    parte.getContext("2d")!.drawImage(canvas, 0, topo, canvas.width, h, 0, 0, canvas.width, h);
    const png = await pdf.embedPng(parte.toDataURL("image/png"));
    const page = pdf.addPage(A4);
    const ph = (h / canvas.width) * A4[0];
    page.drawImage(png, { x: 0, y: A4[1] - ph, width: A4[0], height: ph });
  }
  const falhas: string[] = [];
  for (const a of arquivos) {
    try {
      const mime = a.file.type;
      if (mime === "application/pdf" || /\.pdf$/i.test(a.nome)) {
        const src = await PDFDocument.load(await a.file.arrayBuffer(), { ignoreEncryption: true });
        (await pdf.copyPages(src, src.getPageIndices())).forEach((p) => pdf.addPage(p));
      } else if (mime.startsWith("image/")) {
        const img = mime === "image/jpeg" ? await pdf.embedJpg(await a.file.arrayBuffer()) : await pdf.embedPng(await paraPng(a.file));
        const page = pdf.addPage(A4);
        const esc = Math.min((A4[0] - 60) / img.width, (A4[1] - 90) / img.height);
        const w = img.width * esc, h = img.height * esc;
        page.drawText(seguro(`${a.tipo} - ${a.nome}`), { x: 30, y: A4[1] - 34, size: 9, font: await pdf.embedFont(StandardFonts.Helvetica), color: rgb(0.4, 0.45, 0.53) });
        page.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - 50 - h) / 2 + 10, width: w, height: h });
      } else if (mime.startsWith("text/") || /\.txt$/i.test(a.nome)) {
        await paginaAviso(pdf, `${a.tipo} - ${a.nome}`, (await a.file.text()).split(/\r?\n/));
      } else throw new Error("formato");
    } catch {
      falhas.push(a.nome);
      await paginaAviso(pdf, `${a.tipo} - ${a.nome}`, ["Este arquivo não pôde ser incluído no PDF (protegido ou em formato não suportado). Consulte o original no banco de documentos."]);
    }
  }
  const bytes = await pdf.save();
  return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), falhas };
}

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
