# Figures

Every screenshot in the thesis is inserted with
`\screenshot[width]{file.png}{Caption}{label}`, which renders the image **if
`thesis/figures/file.png` exists** and a grey labelled placeholder if it does
not. The document always compiles, and a missing file is visible in the PDF
instead of silently absent.

## Screenshots (Chapter 5)

All twelve are captured from the running prototype at 1440 px wide, on the
evaluation corpus described in Section 5.7. To replace one, overwrite the file
with the same name; no LaTeX edit is needed.

| File | What it shows |
|------|---------------|
| `home.png` | Public landing page with both report entry points and recent items |
| `auth-login.png` | Sign-in form (cropped to the form) |
| `report-form.png` | Report wizard, step 2 of 5: details and category |
| `browse.png` | Browse view with category, wilaya and date filters |
| `item-matches.png` | A confirmed suggestion at 86 % with its reasons (cropped to the panel) |
| `locked-matches.png` | Locked suggestions: confidence visible, counterpart withheld, first unlock free |
| `billing.png` | Credit page: balance, free allowance, the three packs |
| `claim.png` | Claim form answering the reporter's verification questions |
| `notifications.png` | Notification centre |
| `dashboard.png` | Personal dashboard |
| `admin-overview.png` | Administration console, overview page |
| `arabic-rtl.png` | The dashboard in Arabic, mirrored right-to-left |

Before printing, check that no screenshot shows a real person's e-mail address,
phone number or full name.

## Other figures

| File | What it is | Where it goes |
|------|-----------|---------------|
| `logo-uamob.png` | University logo | Title page (optional — omitted cleanly if absent) |
| `logo-faculty.png` | Faculty/department logo | Title page (optional) |

## Diagrams and charts need no files

These are drawn in LaTeX directly in the `.tex` sources — vector, editable,
and consistent with the document's colours:

| Diagram | Where | Drawn with |
|---------|-------|-----------|
| Gantt project schedule | Ch. 1 | `pgfgantt` |
| Market funnel (TAM / SAM / SOM) | Ch. 3 | TikZ |
| Competitive positioning matrix | Ch. 3 | TikZ |
| Service delivery process | Ch. 4 | TikZ |
| Deployed architecture | Ch. 5 | TikZ |
| Entity-relationship diagram | Ch. 5 | TikZ |
| Matching pipeline | Ch. 5 | TikZ |
| Distribution of CLIP similarities | Ch. 5 | `pgfplots` |
| Sequence diagram (report → handover) | Ch. 5 | TikZ |
| Use-case diagram | Ch. 5 | TikZ |
| Break-even chart | Ch. 6 | `pgfplots` |
| Business Model Canvas | Ch. 7 | TikZ |

The two charts plot measured data. The CLIP histogram comes from the
`item_images.image_embedding` vectors in the database; the break-even lines
come from the cost and revenue model of Chapter 6. If the data changes, update
the coordinates in the chapter file.

## Notes

- **PNG only.** `\IfFileExists` matches the exact filename, so `home.jpg` will
  not be picked up by `\screenshot{home.png}{...}`.
