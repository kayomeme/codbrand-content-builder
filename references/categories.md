# Categories — Default WP List + Auto-Categorization Heuristics

The skill picks **exactly one** category per pattern, automatically, from the 20 defaults that ship with WordPress. Never ask the user.

## The 20 default categories

`featured`, `about`, `audio`, `banner`, `buttons`, `call-to-action`, `columns`, `contact`, `footer`, `gallery`, `header`, `media`, `portfolio`, `posts`, `query`, `services`, `team`, `testimonials`, `text`, `video`

## Heuristics — pick the FIRST that matches

| If the source contains… | Pick |
|---|---|
| Top-of-page logo + nav menu + (optional) topbar/search | `header` |
| Bottom-of-page copyright + multi-column links + social | `footer` |
| Single big heading + short subhead + 1-2 buttons + (often) full-width background image | `banner` |
| Compact heading + button(s), centered, on a colored band — no background image | `call-to-action` |
| Multiple service/feature cards (icon/image + heading + short paragraph), 2-4 across | `services` |
| Quote(s) + person photo + name/role | `testimonials` |
| Member cards (avatar + name + role) | `team` |
| Form fields (name/email/message) + submit button | `contact` |
| Photo grid, image-heavy, captions optional | `gallery` |
| Video player or hero with embedded video | `video` |
| Audio player or podcast-style block | `audio` |
| Project/case-study showcase grid with images + titles | `portfolio` |
| Posts query / blog post list / "Latest from blog" | `posts` (preferred) or `query` (when emphasis is on filtering) |
| Story / mission / introductory copy about a person or brand | `about` |
| Pricing table, comparison grid, feature list | `featured` (no native pricing category) |
| FAQ / accordion / structured Q&A | `text` |
| Stats counters / metric callouts | `text` |
| Logo wall (client/partner logos in a row) | `featured` |
| Standalone button group / CTA buttons row | `buttons` |
| Table or formatted text article | `text` |
| Multi-column layout that doesn't fit anywhere else | `columns` |
| Mixed media spotlight (image + headline + body) | `media` |
| Editor's-pick / hand-curated showcase | `featured` |

## Tie-breaker rules

- **Buttons inside a hero image** → `banner` wins over `call-to-action` (the visual is dominant).
- **Pricing / comparison tables** → `featured`, NOT `text`.
- **Posts query inside a section** → `posts`. The `query` slug is older and most patterns now use `posts`.
- **A pattern that does many things** → pick by primary user intent (the headline action), not by element count.

## What NOT to do

- Do not register custom categories. The skill is constrained to defaults to keep the pattern library portable.
- Do not assign multiple categories. Pick one. Multiple categories make the inserter UI noisy.
- Do not ask the user "which category?" — the skill commits, then the user can correct in feedback.

## When the user pushes back

If the user disagrees with a category choice, update this file with the new heuristic.
