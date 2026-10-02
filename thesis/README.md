# Thesis source (`thesis/`)

Overleaf-ready LaTeX project for the Master's thesis on **Sabtou**, the
AI-powered lost & found platform in this repository.

The structure mirrors the department's startup-format thesis: seven chapters
(project → innovation → market → organization → prototype → finance → business
model), a conclusion, and a bibliography.

---

## Getting it into Overleaf

The template was rebuilt from a PDF, so there is no `.cls` to import — the
styling lives in `preamble/`.

1. Zip the **contents** of this folder (so `main.tex` is at the root of the zip,
   not inside a `thesis/` folder):
   ```powershell
   Compress-Archive -Path .\thesis\* -DestinationPath .\thesis.zip
   ```
2. Overleaf → **New Project → Upload Project** → drop `thesis.zip`.
3. **Menu → Compiler → pdfLaTeX** (see *Engine* below — this matters).
4. Compile. It should build on the first try.

If you have Overleaf premium, use its Git integration instead and keep this
folder as the source of truth.

---

## Building locally

Any TeX Live distribution works. A minimal one is
[TinyTeX](https://github.com/rstudio/tinytex-releases) (about 300 MB once the
packages below are added); install it on a drive with room to spare.

```bash
tlmgr install babel-english babel-french hyphen-french csquotes lm microtype \
  setspace float booktabs multirow enumitem caption titlesec fancyhdr listings \
  pgf pgfgantt pgfplots cite latexmk
latexmk -pdf main.tex     # latexmkrc is already configured
latexmk -c                # clean aux files
```

Without `latexmk`, run `pdflatex main`, `bibtex main`, then `pdflatex main`
twice. The build should finish with no overfull boxes and no undefined
references; check the log for `Overfull` after any edit to a table or
diagram.

---

## Engine: pdfLaTeX, deliberately

The reference thesis is English with a French *Résumé*, and pdfLaTeX handles
both. **Arabic script would require XeLaTeX or LuaLaTeX** plus `polyglossia`
and an Arabic font.

If your jury requires an Arabic abstract (ملخص), that is a real change, not a
tweak: switch the compiler to XeLaTeX, replace `inputenc`/`fontenc`/`babel` in
`preamble/packages.tex` with `fontspec` + `polyglossia`, and set an Arabic font.
Everything else in the project survives the switch. Screenshots of the Arabic
*interface* are unaffected — those are images.

---

## Layout

```
thesis/
├── main.tex                    ← compile this
├── latexmkrc                   ← build config (Overleaf reads it)
├── preamble/
│   ├── packages.tex            ← package loads
│   ├── style.tex               ← chapter headings, headers, table columns, TikZ styles
│   └── macros.tex              ← TITLE, YOUR NAME, SUPERVISOR live here
├── frontmatter/
│   ├── titlepage.tex           ← UAMOB title page
│   ├── acknowledgments.tex
│   ├── dedication.tex
│   ├── abstract.tex            ← written
│   └── resume.tex              ← written (French)
├── chapters/
│   ├── 01-project-presentation.tex    ← written (Gantt drawn; team needs your names)
│   ├── 02-innovative-aspects.tex      ← written
│   ├── 03-market-analysis.tex         ← written, with cited national figures
│   ├── 04-production-organization.tex ← written, procurement priced in Ch. 6
│   ├── 05-experimental-prototype.tex  ← written from the code, with measured evaluation
│   ├── 06-financial-plan.tex          ← real monthly costs, cited; revenue from the real packs
│   ├── 07-business-model.tex          ← written, canvas drawn in TikZ
│   └── conclusion.tex                 ← written
├── bibliography/references.bib        ← 48 entries, all cited
└── figures/                    ← 12 screenshots (+ optional logos); see figures/README.md
```

---

## First things to edit

1. **`preamble/macros.tex`** — `\thesistitle`, `\thesissupervisor`,
   `\thesisstudentone` (and `two`/`three` if you are a team). These feed the
   title page. They currently say `TODO`.
2. **The red `TO WRITE` boxes** — four remain, all things only you can write:
   the team members (Ch. 1), the real dates of the schedule (Ch. 1), the
   acknowledgments and the dedication. Set `\showtodosfalse` in `main.tex` to
   hide them all before the final print.
3. **`figures/`** — all twelve screenshots are in place. Check that none shows
   a real person's contact details before printing.

---

## Figures and numbers: what is sourced, what is assumed

**Measured** — every number in Chapter 5's evaluation (corpus, cross-lingual
experiment, CLIP similarity distribution, matching outcomes, latencies, memory)
was measured on the running prototype in late September 2026.

**Cited** — Chapter 3's market figures come from ARPCE, DataReportal, MESRS and
Macrotrends. Chapter 6's costs are real public prices: Oracle's free tier,
Hetzner's June 2026 price list, Chargily's fee plans, the .dz domain, Brevo,
the auto-entrepreneur levies (IFU, CASNOS), company formation, VAT, junior
salaries, and the official and parallel euro rates of 24 September 2026. Each
source is in `references.bib` with the figure used recorded in its `note`.

**Assumed** — only three quantities in Chapter 6 are hypotheses, and the chapter
varies each across three scenarios: the share of reports with more suggestions
than the free unlock covers, the share of those owners who buy, and the monthly
report volume. The pack mix (50 / 40 / 10 %) is also an assumption.

**Check before printing** — prices and exchange rates move. Re-verify the cited
figures near your defence date.

### Diagrams and charts (12, all drawn in LaTeX)

Gantt schedule (Ch. 1) · market funnel and positioning matrix (Ch. 3) · service
process (Ch. 4) · architecture, ER diagram, matching pipeline, CLIP similarity
histogram, sequence diagram, use-case diagram (Ch. 5) · break-even chart
(Ch. 6) · Business Model Canvas (Ch. 7).

To change one, edit its `tikzpicture` in the chapter file. They use `pgfgantt`
and `pgfplots`, both standard on Overleaf.

---

## What Chapter 5 already contains

Written from the actual implementation, not from the design docs — the two have
diverged, and the chapter follows the code:

- Full front-end and back-end technology tables
- Architecture, ER, pipeline, sequence and use-case diagrams
- The multilingual text encoder and the measured reason for it (72/72
  cross-language queries against 23/72 for an English-only model)
- Candidate retrieval, including the image-only second route
- **The CLIP calibration finding** — measured distribution of raw similarities
  (median 0.578 for unrelated pairs) and the floor-rescaling that fixes it
- Fusion with weight redistribution, lexical blending, confidence boosts,
  distinctiveness margin, thresholds, and the full parameter table
- UI walkthrough with 12 screenshots, including the paid matching tier and the
  administration console
- Experimental evaluation on the prototype's own data, with its limits
- Testing, Docker packaging, the production deployment kit

Anything you change in the code that contradicts this chapter — a threshold, a
model name, a weight — needs updating here too. The parameter table is the
place it will bite you first.

---

## Bibliography note

`plain` style only prints entries that are actually `\cite`d; an entry added
and never cited silently does not appear. All 48 current entries are cited.
