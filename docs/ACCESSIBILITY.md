# Accessibility report — template & typography overhaul

What §23 of the overhaul brief required and how the shipped UI meets it.
This covers the new surfaces (wizard steps, typography controls, effect
placement, template browser, logo upload); the base app's accessibility
work (skip links, focus management, keyboard shortcuts in the Advanced
Editor) is unchanged.

- **Keyboard navigation & visible focus.** Every new control is a real
  `<button>`, `<select>`, `<input>`, or Radix Switch — natively
  focusable, activatable with Enter/Space, with the design system's
  `:focus-visible` ring. The template browser is a dialog with focus
  trapping and Escape-to-close (Radix Dialog); its filter panel is
  buttons + labeled selects, not hover menus. Nothing anywhere in Easy
  mode requires hover or drag (§19 overlap).
- **Screen-reader labels.** Template cards carry descriptive labels
  ("Obsidian Gold — Obsidian Gold family, dark design"); favorites
  toggles announce add/remove per template with `aria-pressed`; glass
  chips sit in a labeled `role="group"`; personality chips expose their
  blurb as `title` and state as `aria-pressed`; every wizard switch has
  an explicit `aria-label`; the vial preview and decorative glyphs are
  `aria-hidden` with text alternatives alongside.
- **Never color alone.** Materials are named cards with plain-language
  descriptions; palettes have names in their accessible labels ("Use the
  Black & gold colors"); light/dark and density appear as text badges on
  template cards; the strength color-coding in the matching-label flow
  is a labeled choice, not an unlabeled swatch row.
- **Contrast.** All 28 palettes guarantee WCAG-checked ratios by
  construction (unit-tested), and the §21 template gates verify every
  text row against its ACTUAL backing (panel, chip, band, or background)
  at print floors — 4.5:1 for small regular text, 3.5:1 for small bold,
  3:1 at display sizes. Contrast preflight findings are plain-language
  list items with a one-click "Fix contrast" button.
- **Reduced motion.** A global `prefers-reduced-motion` rule disables
  transitions/animations; the holographic ReactiveShine additionally
  hides its shine layer AND skips its device-orientation listener under
  reduced motion. 3D vial auto-rotation only ever runs when the user
  presses Spin.
- **Font previews include readable names.** Pairing names render in
  their own display face only after the font loads, with the name
  visible in the UI font until then — no invisible text and no layout
  jump gates the control.

Known limits (tracked in [deferred.md](./deferred.md)): iOS tilt-to-shine
stays off (permission prompt not worth a decoration), and the template
browser's card grid virtualizes via `content-visibility` rather than a
windowing list — with 120 cards this keeps scrolling smooth on a
mid-range phone, and a windowed list is unnecessary at this scale.
