<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- App data lives in Lovable Cloud tables (jsonb `dados` per entity); `src/lib/store.ts` loads it after sign-in and `setState` diffs old/new state to upsert/delete rows, so pages keep a simple synchronous API.
- Access rules (Admin/Gerente/Corretor, invite-only signup via `convites` + auth trigger) are enforced by RLS in the database; UI hiding is cosmetic only.
- All app pages live under `src/routes/_authenticated/` (client-only gate that also loads the store); `/auth` and `/reset-password` are the only public pages.
- Commission cascade logic lives only in `src/lib/rateio.ts` (pure, tested in `src/test/rateio.test.ts`); UI pages call it via `src/lib/helpers.ts`.
- Document extraction runs server-side in `src/lib/extracao.functions.ts` (Lovable AI Gateway, strict JSON schema, streamed); the API key never reaches the browser.
- Source highlighting: AI returns a literal quote per field; the browser OCRs the uploaded file (tesseract.js, pdfjs for PDFs) and matches quotes to word boxes via `src/lib/trechos.ts`, because model-provided coordinates are unreliable.
