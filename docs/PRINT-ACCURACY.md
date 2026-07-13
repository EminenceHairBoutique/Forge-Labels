# Print accuracy

How Forge Labels guarantees physical dimensions, and the procedure for
getting a printed label that actually fits your vial. Deployment concerns
are in [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md).

## How dimensions work

Millimeters are the canonical unit for every stored dimension. Documents,
presets, and geometry never store pixels; every other unit is derived in one
place — `src/lib/geometry/units.ts` — so print size cannot drift between the
editor, exports, and imposition.

| Surface | Conversion | Where |
| --- | --- | --- |
| Editor screen | screen px = mm × zoom | Konva stage groups scale by zoom |
| Raster export | raster px = mm / 25.4 × DPI | `mmToPx` in `units.ts` |
| PDF | pt = mm × 72 / 25.4 | `mmToPt` in `units.ts` |
| Font sizes | stored as typographic points (1 pt = 1/72 in) | document schema |

Enforcement details:

- `exportRaster` (`src/lib/export/raster.ts`) renders at
  `pixelRatio = dpi / 25.4` and then compares the canvas against
  `round(mmToPx(size, dpi))`. If Konva's independent rounding differs by a
  pixel, the output is redrawn onto a canvas of the exact target size, so a
  50 × 120 mm label at 300 DPI is always 591 × 1417 px.
- PNG exports carry a pHYs chunk stamped with the export DPI
  (`src/lib/export/png-dpi.ts`), so RIPs and image tools read the correct
  physical size instead of assuming 72 or 96 DPI.
- PDFs take their physical size from box math, not the raster: the page,
  TrimBox (finished label), and BleedBox (artwork extent) are set in points
  via `mmToPt` (`src/lib/export/pdf.ts`). The embedded raster's resolution
  affects sharpness only, never size.

## Measure your vial

Vials of the same nominal volume vary between manufacturers. Measure the
actual vial (or its manufacturer drawing) before printing a run — the
calculator emits this reminder on every result.

1. **Diameter.** Use calipers on the body at the label zone, not the neck or
   shoulder. Take two readings 90° apart and average them.
2. **Circumference.** The calculator computes `circumference = π × diameter`
   (`src/lib/geometry/label-calculator.ts`).
3. **Wrap width.** For full wraps, `width = circumference − gap`. The default
   seam gap is 3 mm (`DEFAULT_GAP_MM`); 2–4 mm is comfortable for hand
   application, and the calculator warns below 2 mm and flags overlap
   (negative gap) for thin films only.
4. **Straight-wall height.** Measure only the cylindrical section. The
   default label height is the straight wall minus 4 mm
   (`DEFAULT_VERTICAL_MARGIN_MM`, 2 mm top and bottom); a label taller than
   the straight wall is a calculator **error** because it will wrinkle where
   the glass curves.
5. **Small diameters.** Below 15 mm diameter the calculator warns that stiff
   stock may lift or wrinkle — use thin, flexible material.

**Why 0.5 mm of diameter error matters.** Circumference error is
π × diameter error, so measuring 0.5 mm too small makes the wrap
π × 0.5 ≈ 1.6 mm short — a visibly wider seam gap, or on a butt seam, a gap
where none was intended. Caliper the diameter to 0.1 mm.

## Printer calibration

Desktop printers routinely scale and shift pages. The print-sheet dialog
exports a calibration page (`createCalibrationPdf` in
`src/lib/export/sheet-pdf.ts`) containing two 100 mm reference bars
(horizontal and vertical) and mm-graduated rulers starting 10 mm from the
top-left paper edges.

1. Print the calibration page at **100% / Actual size**. Never use
   "fit to page", "shrink to printable area", or borderless scaling.
2. Measure both reference bars with a steel ruler. Each must be exactly
   100 mm.
3. Measure from the paper edges to the ruler origins; both should be 10 mm.
   Enter the differences as X/Y offsets in the print-sheet dialog: positive
   X shifts labels right, positive Y shifts them down. The offsets translate
   the whole imposition grid (`offsetXMm`/`offsetYMm` in
   `src/lib/print/imposition.ts`), and the dialog warns if the shift pushes
   labels off the page.
4. **Scale drift diagnosis.** If a bar measures 96–97 mm, the driver is
   scaling (a common default). Offsets only translate — they cannot fix
   scale. Find and disable the scaling option, reprint, and re-measure until
   both bars read 100 mm before trusting any label output.

## Pre-print checklist

Run preflight in the editor and resolve every **error**; read each warning
deliberately. Thresholds below are the shipped values in
`src/lib/preflight/rules.ts` and `src/lib/codes/qr.ts`.

- [ ] Preflight shows zero errors.
- [ ] Bleed is at or near the 2 mm default; preflight warns under 1 mm
      (most printers need 1.5–3 mm to avoid white edges after cutting).
- [ ] Text, QR codes, and barcodes sit inside the 3 mm safe zone; cutting
      tolerance can clip anything outside it.
- [ ] No text below 3.5 pt (error); prefer 5 pt and up (warning below).
      For labels under 15 mm tall the calculator's floor is 4 pt.
- [ ] No lines thinner than 0.4 pt — hairlines drop out in print.
- [ ] Images print at 250+ effective DPI (warning below 250, error below
      140). Fix by using a larger source or shrinking the image.
- [ ] QR modules are at least 0.4 mm and the quiet zone is at least
      4 modules; enlarge the code or shorten the payload otherwise.
- [ ] Barcode values pass validation (EAN-13/UPC-A check digits are
      verified); keep linear barcodes at least 8 mm tall for handheld
      scanners.
- [ ] Test-scan the QR code and barcode **on the printed label, applied to
      the curved vial** — curvature and gloss defeat marginal codes.
- [ ] Text has adequate contrast against the background (preflight warns
      below a 2.5:1 ratio) and highly saturated screen colors may shift in
      CMYK conversion.
- [ ] Export at the recommended DPI: 600 for labels narrower than 40 mm or
      shorter than 15 mm, otherwise 300.
- [ ] Finishes are **on-screen simulations**. Physical foil, holographic
      film, and textured stocks differ from the preview in color, sheen, and
      coverage — order a printed proof before a production run. For presses
      that print them, assign objects to production layers and export
      **Separations** (see below).
- [ ] Print one sheet, cut one label, and apply it to a real vial before
      committing the batch.

## Substrate notes

Substrate previews (`src/lib/finishes/types.ts`) simulate the stock under
transparent areas of the design:

- **White polypropylene** (default) — anything printable; transparent
  background prints as white.
- **Clear polypropylene** — the no-label look. There is no white ink in a
  desktop workflow: near-white artwork is effectively invisible, and
  preflight raises `white-ink-needed` for near-white fills on transparent
  stock. For commercial printing, assign the underbase objects to the
  **White ink** layer (properties panel → Print layer) and export
  Separations.
- **Silver / holographic polyester** — unprinted areas stay metallic;
  inks print semi-translucent over the film, and the same white-ink caveat
  applies wherever you want opaque color.
- **Kraft and textured papers** — not waterproof; expect ink gain and muted
  color on uncoated fiber.

## Separations conventions

The **Separations** export (export dialog) produces one PNG per print layer
actually in use, for presses that print white ink, foils, spot UV, emboss,
or die-cut guides as separate processes:

- Assign layers per object in the properties panel (**Print layer**). A
  group's non-artwork layer applies to all its children unless a child sets
  its own non-artwork layer (`src/lib/print/layers.ts`).
- Files are named `{label}-{n}-{layer}.png` in a stable order and rendered
  at 600 DPI including bleed — pixel dimensions match the raster export
  guarantee above.
- The **artwork** file includes the label background. Every spot layer
  renders its objects **on transparency, at authored colors**: the file is
  a positive/mask for your printer to map onto the physical process, not a
  color simulation of it.
- `manifest.csv` and `README.txt` in the ZIP restate the finished size,
  bleed, DPI, and per-layer intent — send the whole ZIP to the print shop
  and confirm their layer handling before a production run.
- Preflight flags two layer mistakes: white ink assigned on opaque white
  stock (usually unintended) and text/images on the die-cut layer (die
  lines should be simple shapes).
