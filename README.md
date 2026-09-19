# codbrand-content-builder — references, examples & scripts

Everything the `codbrand-content-builder` skill uses, except its entry point. The skill turns HTML/CSS
or a screenshot into native WordPress block markup.

## This is most of a skill, but not its entry point

`SKILL.md` — the skill's instructions — **ships inside the COD Leads plugin** and is installed from
there. Everything `SKILL.md` refers to lives here:

| in this repository | ships with the plugin |
|---|---|
| `references/` — serialization detail, snippets, block supports, theme tokens | `SKILL.md` — the procedure and the rules |
| `examples/` — the teaching corpus | |
| `scripts/` — the validators | |

The layout matches the installed skill exactly, so the contents of this repository drop straight into
a skill folder with no renaming and no merge step.

## Use the tag, not the default branch

Each tag corresponds to a COD Leads plugin version. An agent reads the store's plugin version from
`/cl-api/v1/me` and fetches the matching tag, so the references, examples and validators it uses
always match the store it is writing to.

The default branch may contain material for blocks that exist only in a newer plugin. Markup built
from those **validates locally and then fails to render** on an older store — which is exactly the
failure the tagging exists to prevent.

---

*Repository created 19-09-2026. Content lands with the first tagged release.*
