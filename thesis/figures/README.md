# Figures

Every figure in the thesis is inserted with `\screenshot{file.png}{Caption}{label}`,
which renders the real image **if `thesis/figures/file.png` exists** and a grey
labelled placeholder if it does not. So the document always compiles, and every
missing figure is visible in the PDF instead of silently absent.

**Just drop the file in with the exact name below — no LaTeX edit needed.**

## Screenshots to capture (Chapter 5)

Take these at ~1440 px browser width, signed in as the demo user, with the
seeded demo data loaded (`docker compose exec api python -m app.db.seed_demo`)
so grids are full rather than empty.

| File | What to capture |
|------|-----------------|
| `home.png` | Public landing page showing both report entry points and recent items |
| `auth-login.png` | Sign-in form, ideally with a validation message visible |
| `report-form.png` | Report form filled in: description, category, wilaya, photos, verification questions |
| `browse.png` | Browse view with the category / wilaya / date filters visible |
| `item-matches.png` | **The most important one.** Item detail showing ranked suggestions with confidence % and the explanation reasons |
| `claim.png` | Claim submission answering the reporter's verification questions |
| `notifications.png` | Notification centre with a match notification |
| `dashboard.png` | Personal dashboard: own reports, statuses, pending claims |
| `arabic-rtl.png` | Any content-rich page switched to `/ar`, showing the mirrored right-to-left layout |

## Other figures

| File | What it is | Where it goes |
|------|-----------|---------------|
| `logo-uamob.png` | University logo | Title page (optional — omitted cleanly if absent) |
| `logo-faculty.png` | Faculty/department logo | Title page (optional) |

That's all. **The screenshots and the two logos are the only image files this
thesis needs.**

## Diagrams need no files

Eight diagrams are drawn in LaTeX directly in the `.tex` sources — vector,
editable, and theme-consistent. Nothing to export, nothing to keep in sync:

| Diagram | Where | Drawn with |
|---------|-------|-----------|
| Gantt project schedule | Ch. 1 | `pgfgantt` |
| Market funnel (TAM / SAM / SOM) | Ch. 3 | TikZ |
| Competitive positioning matrix | Ch. 3 | TikZ |
| Service delivery process | Ch. 4 | TikZ |
| Deployed architecture | Ch. 5 | TikZ |
| Matching pipeline | Ch. 5 | TikZ |
| Entity-relationship diagram | Ch. 5 | TikZ |
| Use-case diagram | Ch. 5 | TikZ |
| Sequence diagram (report → handover) | Ch. 5 | TikZ |
| Break-even chart | Ch. 6 | `pgfplots` |
| Business Model Canvas | Ch. 7 | TikZ |

To change one, edit the `tikzpicture` in the chapter file — not an external tool.

## Notes

- **PNG only.** `\IfFileExists` matches the exact filename, so `home.jpg` will
  not be picked up by `\screenshot{home.png}{...}`.
- Crop out browser chrome, bookmarks bar, and anything containing a real email
  address or personal data.
