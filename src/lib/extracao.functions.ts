import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TIPOS = ["Sinal/Ato", "Mensal", "Semestral", "Chaves", "Financiamento Bancário", "FGTS", "Subsídio"];
const str = { type: "string" };
const schema = {
  type: "object", additionalProperties: false,
  required: ["empreendimento", "unidade", "torre", "vaga", "vgv", "compradores", "parcelas"],
  properties: {
    empreendimento: str, unidade: str, torre: str, vaga: str, vgv: { type: "number" },
    compradores: { type: "array", items: { type: "object", additionalProperties: false, required: ["nome", "cpf", "rg", "endereco", "conjuge"],
      properties: { nome: str, cpf: str, rg: str, endereco: str, conjuge: str } } },
    parcelas: { type: "array", items: { type: "object", additionalProperties: false, required: ["tipo", "valor", "vencimento"],
      properties: { tipo: { type: "string", enum: TIPOS }, valor: { type: "number" }, vencimento: { type: "string", description: "YYYY-MM-DD" } } } },
  },
};

export type Extraido = {
  empreendimento: string; unidade: string; torre: string; vaga: string; vgv: number;
  compradores: { nome: string; cpf: string; rg: string; endereco: string; conjuge: string }[];
  parcelas: { tipo: string; valor: number; vencimento: string }[];
};

const PROMPT = `Você é um analista de cadastro imobiliário. Extraia do documento (proposta de compra, ficha ou documento pessoal) os dados abaixo.
- Valores em reais como número (ex.: 850000.5). VGV = preço total do imóvel.
- Parcelas: liste CADA parcela individualmente com tipo, valor e vencimento (YYYY-MM-DD). Se houver "N mensais de X a partir de DATA", expanda em N itens mensais consecutivos.
- CPF no formato 000.000.000-00. Campos ausentes: string vazia ou 0. Arrays vazios se não houver dados.`;

export const extrairProposta = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    filename: z.string().max(200), mime: z.string().max(100), base64: z.string().min(10).max(14_000_000),
  }).parse(i))
  .handler(async ({ data }): Promise<{ ok: true; dados: Extraido } | { ok: false; erro: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, erro: "Lovable AI não configurado." };
    const isPdf = data.mime === "application/pdf";
    if (!isPdf && !data.mime.startsWith("image/")) return { ok: false, erro: "Envie um PDF ou uma imagem (JPG/PNG/WEBP)." };
    const part = isPdf
      ? { type: "input_file", filename: data.filename, file_data: `data:application/pdf;base64,${data.base64}` }
      : { type: "input_image", image_url: `data:${data.mime};base64,${data.base64}` };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        instructions: PROMPT,
        input: [{ role: "user", content: [{ type: "input_text", text: "Extraia os dados desta proposta." }, part] }],
        text: { format: { type: "json_schema", name: "proposta", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      let msg = "";
      try { msg = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? ""; } catch { /* noop */ }
      if (res.status === 402) return { ok: false, erro: msg || "Créditos de IA insuficientes. Adicione créditos em Settings → Plans & credits." };
      if (res.status === 429) return { ok: false, erro: "Muitas solicitações. Aguarde alguns instantes e tente novamente." };
      return { ok: false, erro: msg || `Falha na extração (${res.status}).` };
    }
    // Consome o stream SSE no servidor e junta o texto final
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", erro = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        const raw = l.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const ev = JSON.parse(raw);
          if (ev.type === "response.output_text.delta") text += ev.delta;
          else if (ev.type === "response.refusal.delta") erro = "O documento não pôde ser analisado.";
          else if (ev.type === "error" || ev.type === "response.failed") erro = ev.error?.message ?? ev.response?.error?.message ?? "Falha na extração.";
        } catch { /* linha parcial */ }
      }
    }
    if (erro) return { ok: false, erro };
    try { return { ok: true, dados: JSON.parse(text) as Extraido }; }
    catch { return { ok: false, erro: "Não foi possível ler dados neste documento." }; }
  });
