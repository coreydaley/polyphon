---
description: Publish a new plugin release (bump version, tag, push)
allowed-tools: Bash(git log:*), Bash(git tag:*), Bash(git status:*), Bash(git diff:*), Bash(git push:*), Bash(npm version:*), Bash(cat:*)
---

# Release

Publish a new release of this Obsidian plugin by analysing commits since the
last tag, computing the correct semantic version bump, running `npm version`,
and pushing the resulting commit and tag to trigger the GitHub Actions release
workflow.

## Obsidian versioning rules

- Tags must be **bare semver** with no `v` prefix (e.g. `0.2.0`, not `v0.2.0`).
  Obsidian's plugin installer matches the tag directly against `manifest.json`'s
  `version` field.
- `npm version` handles the commit + tag automatically.  The `version` script in
  `package.json` runs `version-bump.mjs`, which syncs `manifest.json` and
  `versions.json` before npm commits.

## Steps

### 1 — Verify working tree is clean

Run: `git status --porcelain`

If there are any uncommitted changes, stop and tell the user to commit or stash
them first. Do not proceed with a dirty working tree.

### 2 — Find the last tag and collect commits

Run: `git tag --sort=-version:refname | head -1`

- If a tag exists, collect commits with:
  `git log <last-tag>..HEAD --oneline --no-merges`
- If **no tag exists**, collect all commits with:
  `git log --oneline --no-merges`

If there are **no commits since the last tag**, stop and tell the user there is
nothing to release.

### 3 — Determine the version bump

Scan every commit message using these rules (highest precedence wins):

| Signal | Bump |
|--------|------|
| Body/footer contains `BREAKING CHANGE` | **major** |
| Type ends with `!` (e.g. `feat!:`) | **major** |
| Type is `feat` or `feat(...)` | **minor** |
| Any other conventional commit or unrecognised prefix | **patch** |

Read the current version from `manifest.json` (field `"version"`).
Apply the bump to compute the proposed new version.

### 4 — Show summary

Display:
- Last tag (or "none")
- Current version
- New version and bump type
- The commit(s) that drove the bump decision
- Full list of commits being released

Then proceed immediately — do not ask for confirmation.

### 5 — Run `npm version`

Run: `npm version <bump-type> --message "<version>"`

Where:
- `<bump-type>` is `patch`, `minor`, or `major`.
- `.npmrc` sets `tag-version-prefix=` so the tag will be `0.2.0` not `v0.2.0`.

`npm version` will:
1. Bump `package.json`
2. Run the `version` script → `version-bump.mjs` syncs `manifest.json` +
   `versions.json`, then stages them
3. Create a commit containing `package.json`, `package-lock.json`,
   `manifest.json`, and `versions.json`
4. Create an annotated git tag equal to the new version number

### 6 — Push commits and tag

Run: `git push --set-upstream origin main --follow-tags`

This pushes the version-bump commit **and** the tag in one step, setting the
upstream tracking branch if it is not already set. The tag push triggers the
GitHub Actions `release.yml` workflow, which builds the plugin and attaches
`main.js`, `manifest.json`, and `styles.css` to the GitHub release.

### 7 — Confirm

Show the user:
- The new version number and tag
- The GitHub Actions URL where they can watch the release build:
  `https://github.com/coreydaley/obsidian-ai-agent-sidebar-plugin/actions`
- A reminder that the release will appear at:
  `https://github.com/coreydaley/obsidian-ai-agent-sidebar-plugin/releases`
