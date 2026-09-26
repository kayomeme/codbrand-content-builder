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

## Use exactly the tag your store names

Each release is tagged `skill-YYYY-MM-DD.N` (for example `skill-2026-09-27.1`), and the `SKILL.md` a
store serves belongs to one of them. The store reports that tag as `version_tag` in `/cl-api/v1/me`
and `/cl-api/v1/skills`. Fetch exactly that tag, so the references, examples and validators you use
always match the instructions and the store you are writing to.

Stores whose plugin predates these releases report a `v{plugin version}` tag (for example `v1.2.811`).
Those tags stay here. No tag is ever moved.

The default branch, or a newer release, may contain material for blocks this store does not have.
Markup built from it **validates locally and then fails to render** on that store — which is exactly
the failure the tag exists to prevent.
