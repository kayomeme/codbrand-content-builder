# codbrand-content-builder — examples & scripts

The **examples** and **validation scripts** for the `codbrand-content-builder` skill, which turns
HTML/CSS or a screenshot into native WordPress block markup.

## This is half of a skill, not the whole skill

The skill itself — `SKILL.md` and its `references/` — **ships inside the COD Leads plugin** and is
installed from there. This repository carries only the parts worth updating between plugin releases:

| in this repository | ships with the plugin |
|---|---|
| `examples/` — the teaching corpus | `SKILL.md` — the rules |
| `scripts/` — the validators | `references/` — serialization detail, snippets, block supports |

Both halves use the **same folder layout**, so the contents of this repository drop straight into an
installed skill folder with no renaming and no merge step.

## Use the tag, not the default branch

Each tag matches a COD Leads plugin version. An agent reads the store's plugin version from
`/cl-api/v1/me` and fetches the matching tag, so the examples and validators it runs always match the
store it is writing to.

The default branch may contain examples for blocks that exist only in a newer plugin. Markup built
from those **validates locally and then fails to render** on an older store — which is exactly the
failure the tagging exists to prevent.

---

*Repository created 19-09-2026. Content lands with the first tagged release.*
