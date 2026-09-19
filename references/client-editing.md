# Client-Editable Patterns — Locking, Labels, and Editor Curation

How to ship patterns that clients can edit confidently in the block editor without breaking the layout. Sources: developer.wordpress.org (patterns-and-block-locking, curating-the-editor-experience), 10up Gutenberg Best Practices, Twenty Twenty-Five conventions.

## The one fact to internalize first

**What you publish is unsynced.** The blocks you write land in the page's own content and have NO link back to anything you keep locally — re-running the publisher with the same slug rewrites that page, and nothing else. (Synced patterns are `wp_block` posts created in the WordPress UI. Never emit sync/override attributes like `metadata.bindings` with `core/pattern-overrides` from this skill.)

## `metadata.name` — human labels in List View (apply to every pattern)

```json
{"metadata":{"name":"Review Card"},"style":{...}}
```

Sets the block's label in the editor's List View. Without it, a pattern reads as "Group / Group / Group / Paragraph"; with it, "Review Card / Product Cover / Footer". WP 6.5+ block renaming writes to this same attribute.

**Rules:**
- The pattern's root block ALWAYS gets `metadata.name` with the section name (e.g. `"Verified Review Section"`).
- Major sub-sections (cards, columns with identity, repeated items) get names too (`"Review Card"`, `"Product Card"`).
- `metadata` serializes into the JSON comment only — **no HTML counterpart, no class, no parser risk**. Safe to add anywhere.
- Not supported on: `core/block`, `core/template-part`, `core/pattern`, `core/navigation`.

## Locking levels — from loose to strict

### Per-block lock (move / remove)
```json
{"lock":{"move":true,"remove":true}}
```
Applied per block. `move:true` = can't be reordered; `remove:true` = can't be deleted. Content stays editable. Use on structural blocks the layout depends on (the image in a product card, a separator).

### Container `templateLock` (Group / Cover / Columns / Column / Navigation)
| Value | Effect on children |
|---|---|
| `"all"` | No moving, no removing, no inserting. Text still editable. |
| `"insert"` | Can move/remove existing children, nothing new can be inserted. |
| `"contentOnly"` | **The client-safe sweet spot** — see below. |
| `false` | Explicitly unlock (overrides an inherited lock). |

### `templateLock:"contentOnly"` — the delivery-grade option
```json
<!-- wp:group {"templateLock":"contentOnly","metadata":{"name":"Hero"},"className":"cod-brand",...} -->
```
Effects in the editor:
- Users can edit ONLY text and swap media. Layout, colors, spacing, block structure — all untouchable.
- List View collapses to the container + content blocks; design blocks aren't even selectable.
- The Settings sidebar hides design controls and shows a simplified "Content" panel listing the editable bits.

Facts:
- **There is NO editor UI to set contentOnly — it can only be hand-written into markup.** That makes it a generation-time decision for this skill.
- It does not reliably cascade into deeply nested containers — set it on the outermost wrapper.
- UI-set locks can be toggled off by users with lock permissions; to hard-enforce, filter `block_editor_settings_all` → `canLockBlocks` (theme scope, not pattern scope).

**Project convention: contentOnly is OPT-IN at delivery, not the default.** During design iteration the user needs full controls; `cod-brand` patterns ship unlocked. When a pattern is delivered to a client site, flip the root group to `templateLock:"contentOnly"` (one attribute — no other markup change needed). Offer this to the user when they say a pattern is final/for-client.

## Header fields that curate where patterns appear

| Header | Use when |
|---|---|
| `Block Types: core/template-part/header` | Header patterns — offered when the user creates/replaces a header template part. Same for `core/template-part/footer`. |
| `Block Types: core/post-content` + `Post Types: page` | Full-page starter patterns — appear in the "start with a pattern" modal on new pages (modal shows when ≥2 such patterns exist). |
| `Template Types: 404, home, single` | Pattern suggested when creating a matching template (WP 6.2+). |
| `Inserter: no` | Internal-only building block — hidden from the picker. Convention (Twenty Twenty-Five): name these `hidden-*`. |

**`Description` is a screen-reader/accessibility field**, read aloud when browsing the inserter — write it as a factual description of what the pattern contains, not marketing copy.

## Recipe cheat sheet

| Goal | Recipe |
|---|---|
| Client edits text/images only | `templateLock:"contentOnly"` on root group |
| Client can reorder cards but not delete the grid | `templateLock:"insert"` on the grid group + `lock:{move:false,remove:true}` on cards |
| Delete-proof a single structural block | `lock:{"move":true,"remove":true}` on that block |
| Readable List View | `metadata.name` on root + major sub-groups |
| Header pattern offered in Site Editor | `Block Types: core/template-part/header` |
| Starter page layout | `Block Types: core/post-content` + `Post Types: page` |
