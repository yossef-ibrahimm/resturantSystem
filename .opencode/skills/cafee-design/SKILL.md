---
name: cafee-design
description: Use when building or editing any UI component, page, layout, styling, or visual element in this cafe system project. Loads the project design system defined in DESIGN.md (cream canvas, coral primary #cc785c, serif display headlines, dark navy product surfaces, color/typography/spacing/component tokens).
---

# Cafe System Design System

This project follows a complete design system documented in `DESIGN.md` at the
project root. **Always read `DESIGN.md` before creating or modifying any UI**,
and follow its tokens strictly.

## Core rules (quick reference)

- Canvas is warm cream (`#faf9f5`) — never pure white or cool gray.
- Primary accent is warm coral (`#cc785c`); active/darker state `#a9583e`. Reserve coral for primary CTAs and full-bleed callout cards.
- Display headlines: serif (Copernicus / Tiempos Headline / Cormorant Garamond fallback), weight 400, negative letter-spacing (-0.3px to -1.5px). Never bold, never sans.
- Body/UI text: humanist sans (StyreneB / Inter), weight 400–500.
- Code: JetBrains Mono.
- Dark surfaces (`#181715`) for product mockups, code windows, footer; light cream cards (`#efe9e9` family) for feature cards. Alternate surface modes between bands — never repeat the same surface twice in a row.
- Radius: 8px buttons/inputs, 12px cards, 16px hero containers, pill badges.
- Spacing base 4px; section rhythm 96px; card padding 32px.
- Depth is color-block first — shadows are rare/minimal.
- Reference tokens as `{colors.*}`, `{typography.*}`, `{rounded.*}`, `{spacing.*}`, `{component.*}` — never inline hex values.

For full token tables, component specs, responsive breakpoints, and do's/don'ts,
read `DESIGN.md`.
