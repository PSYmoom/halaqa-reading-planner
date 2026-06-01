# Halaqa Reading Planner

Builds the weekly **Tafsir Ibn Kathir** reading-assignment message for your halaqa — sized by each person's availability, rotated across teams, formatted for WhatsApp with a Quran.com link per reader.

## Quick start

The build (`dist/`) isn't committed, so build it once:

```bash
npm install
npm run build     # → dist/index.html (one self-contained file)
```

Then open **`dist/index.html`** in any browser — no server, works on its own. First load needs internet to fetch the tafsir; each surah is cached after that.

For live development: `npm run dev` (server at http://localhost:5173).

## How it works

- **Buckets** are availability tiers. Each week one reader is taken from every bucket (round-robin within each), so readers per week = number of buckets.
- **Weights** (1–10 per person) divide the week's content proportionally, at section boundaries — more free time → higher weight → a larger share.
- Pick a **surah + start ayah**, set the **word budget**, drag the **split bar** to fine-tune, then **Copy message**. **Mark as sent** rotates each bucket and advances the start ayah for next week.
- Bucket/member edits are staged until **Save**; click a name to make them this week's reader (a one-week override). Toggle a bucket **off** to skip it for the week.

## Notes

- Tafsir from [spa5k/tafsir_api](https://github.com/spa5k/tafsir_api) (`en-tafisr-ibn-kathir`) via jsDelivr (GitHub-raw fallback). Navigation is the per-reader Quran.com link.
- Section detection is heuristic — if a heading is mis-split, drag the divider before copying.
- Settings live in **localStorage, per browser**; use **Export / Import config** to move them.
- `src/engine.js` is pure functions (no React), so the core logic is easy to test in Node.
