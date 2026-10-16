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
- App data lives in a localStorage-backed store (`src/lib/store.ts`, useSyncExternalStore); seed must stay deterministic so SSR hydration matches.
- Commission cascade logic lives only in `src/lib/rateio.ts` (pure, tested in `src/test/rateio.test.ts`); UI pages call it via `src/lib/helpers.ts`.
