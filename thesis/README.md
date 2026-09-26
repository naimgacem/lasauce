# Thesis source (`thesis/`)

Overleaf-ready LaTeX project for the Master's thesis on **LaSauce**, the
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
4. Compile. It should build on the first try, with grey placeholder boxes where
   screenshots are still missing.

If you have Overleaf premium, use its Git integration instead and keep this
folder as the source of truth.

---

## Building locally

Nothing is installed on this machine, so local builds need MiKTeX or TeX Live
first. Once installed:

```bash
latexmk -pdf main.tex     # latexmkrc is already configured
latexmk -c                # clean aux files
```

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
│   ├── style.tex               ← chapter design, headers, listing/TikZ styles
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
│   ├── 04-production-organization.tex ← written, with costed procurement
│   ├── 05-experimental-prototype.tex  ← written in full from the codebase
│   ├── 06-financial-plan.tex          ← written, projection on stated assumptions
│   ├── 07-business-model.tex          ← written, canvas drawn in TikZ
│   └── conclusion.tex                 ← written
├── bibliography/references.bib        ← 28 entries, all cited
└── figures/                    ← only screenshots + logos; see figures/README.md
```

---

## First things to edit

1. **`preamble/macros.tex`** — `\thesistitle`, `\thesissupervisor`,
   `\thesisstudentone` (and `two`/`three` if you are a team). These feed the
   title page. They currently say `TODO`.
2. **`figures/`** — capture the nine screenshots listed in `figures/README.md`.
   Each replaces its grey placeholder automatically, no LaTeX edit needed.
   Every *diagram* is drawn in LaTeX and needs no file.
3. **The red `TO WRITE` boxes** — what remains is only what genuinely can't be
   derived: your team's names, your real supplier quotes, and a handful of
   judgement calls flagged for you to confirm. Set `\showtodosfalse` in
   `main.tex` to hide them all before the final print.

---

## Figures and numbers: what is sourced, what is assumed

**Cited** — Chapter 3's market figures come from ARPCE, DataReportal, MESRS and
Macrotrends; Chapter 6's infrastructure prices from published Hetzner and
Railway rates; the exchange rate from a dated source. All are in
`references.bib` with the specific figure recorded in the `note` field.

**Modelled** — Chapter 6's revenue projections, headcount and subscription price
are business hypotheses, and Section 6.1 says so explicitly and lists them in a
table before using them. Replace the salary basis and the subscription price
with real quotes before the defence; everything else recomputes from those two.

**Check before printing** — telecom and population statistics are revised
quarterly and cloud prices change. Re-verify the cited figures near your defence
date.

### Diagrams (11, all drawn in LaTeX)

Gantt schedule (Ch. 1) · market funnel and positioning matrix (Ch. 3) · service
process (Ch. 4) · architecture, matching pipeline, ER diagram, use-case diagram,
sequence diagram (Ch. 5) · break-even chart (Ch. 6) · Business Model Canvas
(Ch. 7).

To change one, edit its `tikzpicture` in the chapter file. They use `pgfgantt`
and `pgfplots`, both standard on Overleaf.

---

## What Chapter 5 already contains

Written from the actual implementation, not from the design docs — the two have
diverged, and the chapter follows the code:

- Full front-end and back-end technology tables
- Two TikZ diagrams (deployed architecture; matching pipeline) — vector-drawn,
  no image files needed
- The multilingual text encoder and why an English-only model fails here
- Candidate retrieval, including the image-only second route
- **The CLIP calibration finding** — unrelated photos scoring ~0.7 raw cosine,
  and the floor-rescaling that fixes it, with references
- Fusion with weight redistribution, lexical blending, confidence boosts,
  distinctiveness margin, thresholds
- Full parameter table with the real configured values
- UI walkthrough (9 screenshot slots), the claim workflow, RTL support
- Testing, Docker packaging, deployment

Anything you change in the code that contradicts this chapter — a threshold, a
model name, a weight — needs updating here too. The parameter table is the
place it will bite you first.

---

## Bibliography note

`plain` style only prints entries that are actually `\cite`d. `references.bib`
contains more entries than are currently cited (tool docs, FAISS); uncited ones
will simply not appear. The market/statistics sources for Chapter 3 are not
there yet — a comment at the bottom of the `.bib` lists what to add.
