# Handoff: Manual da Marca Clinik Club

## Overview
Manual de identidade visual do Clinik Club — plataforma de gestão para clínicas (CRM, agenda, marketing). Cobre logotipo, cores, tipografia, padrão gráfico e um sistema de componentes de UI para o aplicativo.

## About the Design Files
The files in this bundle are **design references built in HTML** (a single-file interactive brand manual) — not production code to copy directly. Recreate the design tokens and component specs below in the target codebase's existing stack (React, Vue, etc.), or choose the most appropriate framework if none exists yet.

## Fidelity
**High-fidelity.** Colors, typography, spacing and the component states below are final — implement pixel-close using the target codebase's component library/patterns.

## Design Tokens

### Colors
- Azul Clinik (primary): `#0A2148`
- Azul Sereno (secondary): `#5C6E94`
- Névoa (tint): `#E3E8F1`
- Off-white (background): `#F5F4F1`
- Surface white: `#FCFCFC`
- Border/hairline: `#E4E2DC`
- Success (confirmado): bg `#E7F0E9` / text `#3E7A4E`
- Warning (pendente): bg `#F1EAE3` / text `#9C6B3E`
- Error (cancelado/inválido): bg `#F3E4E1` / text `#A54D42`
- Usage ratio: off-white 55% · Azul Clinik 30% · Névoa 10% · Sereno 5%

### Typography
- Display/headings: **Italiana** (serif), weight 400
- UI/body: **Jost** (sans), weights 300–600
- Lettering "Clinik" wordmark: custom artwork (vector, not a font) — see `assets/clinik-lettering-vetor.svg`. Never redigitized in another typeface.
- Minimum sizes: 24px+ for any display headline context; UI body 13–16px; uppercase labels 10–12px with 0.12–0.24em letter-spacing.

### Signature corner radius
All UI surfaces (buttons, inputs, cards, chips, toasts) use an **asymmetric radius echoing the icon's diagonal symmetry**: `border-radius: 20px 4px 20px 4px` (large cards/containers) or `16px 4px 16px 4px` / `10px 3px 10px 3px` (buttons/inputs, scaled down). Two opposite corners curved, two sharp.

### Motion
- 180ms ease-out — hover/focus/tap feedback
- 260ms ease-in-out — screen transitions, tabs, modals
- No decorative motion. The only "waiting" animation is the 4-dot pulse inside the icon shape (see Components).

## Logo & Icon
- Icon: 4 circles (people) connected by 4 curved petals forming a diamond/rhombus with a 4-point star negative space. Vector source: `assets/clinik-icon.svg`.
- Full lockup (icon + "Clinik" wordmark + "CLUB" caption): `assets/clinik-logo-vetor.svg` (vector) and `assets/clinik-logo-principal.png` / `clinik-logo-negativo.png` (raster, positive/negative).
- Clear space: half the icon's height (x/2) on all sides.
- Minimum size: 70px digital / 20mm print — below that, use the icon alone.
- Never distort, rotate, recolor outside the palette, add shadows/effects, or place on low-contrast backgrounds.

## Graphic Pattern (mesh)
The icon tiles edge-to-edge in a grid where each circle's center lands exactly on its neighbor's — forming a continuous woven "trama". Tile unit: 88×88 (icon scaled 1.17771×, translated -14.897,-14.897 from its native 0–100 box). Always tone-on-tone (never a contrasting color), always bleeding to the edge of the surface. Implemented as an SVG `<pattern>` — see the `#padrao` section in `Manual da Marca Clinik Club.dc.html` for the exact transform math.

## Components (section "10 — Componentes")
- **Buttons**: primary (filled navy), secondary (outline), text/tertiary, disabled — all with the signature corner radius; primary/secondary lift + shadow on hover (translateY(-2px), shadow `0 8px 18px rgba(10,33,72,0.3)`).
- **Inputs**: label above (uppercase, 11px, Azul Sereno), signature radius, focus ring `box-shadow: 0 0 0 3px #E3E8F1` + border → Azul Clinik; error state border `#A54D42` + red helper text.
- **Toggle switch**: signature-radius track (not a pill) — square-ish curved track `border-radius:10px 3px 10px 3px`, knob matches with smaller radius.
- **Tabs**: pill-track with a sliding filled indicator (33.3% width per tab, animated left/width transition, 260ms).
- **Avatars**: circular, initials, overlapping stack with white border.
- **Chips**: removable tag, signature radius, light Névoa background.
- **Status badges**: confirmado/pendente/cancelado — tinted background + colored text, small signature radius.
- **Progress bar**: track `#E3E8F1`, fill Azul Clinik, animated width for loading states.
- **Loading indicator**: the icon itself, with its 4 dots pulsing in sequence (staggered 0/150/300/450ms, scale 0.65→1 + opacity 0.25→1, 1.2s ease-in-out loop) — this is the brand's one approved "waiting" animation.
- **Toast/notification**: navy signature-radius card with icon + title + subtext.

## Tone of Voice
Sereno, preciso, acolhedor — serious/confident without superlatives, plain language over medical/technical jargon, short precise sentences. Product copy (confirmations, notifications) should read like the "✓ Assim" example in section 08, not the exclamation-heavy "✕ Assim não" example.

## Files
- `Manual da Marca Clinik Club.dc.html` — full interactive manual (open in a browser)
- `assets/clinik-icon.svg` — icon vector
- `assets/clinik-logo-vetor.svg` — full lockup vector
- `assets/clinik-lettering-vetor.svg` — wordmark-only vector
- `assets/clinik-logo-principal.png` / `clinik-logo-negativo.png` — raster lockups
- `assets/clinik-icone-navy.png` / `clinik-icone-branco.png` — raster icon only
