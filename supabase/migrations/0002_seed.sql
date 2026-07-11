-- Forge Labels — seed data: plans (pricing lives in the DB, not in code)
-- and template categories. Label templates are seeded from the admin
-- dashboard (/admin → Templates → "Seed from code registry") so the JSON
-- documents stay single-sourced from src/lib/templates.

insert into public.plans
  (id, name, blurb, price_monthly_cents, price_yearly_cents, highlights, entitlements, highlighted, sort)
values
  (
    'free', 'Free', 'Design and print your first labels.', 0, 0,
    '["Full design editor", "Standard vial presets & size calculator", "Starter templates", "PNG export at 300 DPI", "Print-sheet generator", "3 saved projects"]',
    '{"maxProjects": 3, "maxStorageMb": 100, "maxTeamMembers": 1, "hiResExport": false, "printReadyPdf": false, "svgExport": false, "premiumTemplates": false, "finishes": false, "brandKits": false, "qrAndBarcodes": true, "watermarkedMockups": true, "versionHistory": false, "csvBatch": false, "productionLayers": false, "commercialTemplateUse": false, "prioritySupport": false}',
    false, 0
  ),
  (
    'pro', 'Pro', 'For brands shipping real products.', 1200, 1000,
    '["Everything in Free", "Full template library, commercial use", "Print-ready PDF with bleed & crop marks", "600 DPI + SVG vector export", "Holographic, foil & metallic finishes", "Brand kits & watermark-free mockups", "Unlimited projects + version history"]',
    '{"maxProjects": null, "maxStorageMb": 5000, "maxTeamMembers": 1, "hiResExport": true, "printReadyPdf": true, "svgExport": true, "premiumTemplates": true, "finishes": true, "brandKits": true, "qrAndBarcodes": true, "watermarkedMockups": false, "versionHistory": true, "csvBatch": false, "productionLayers": false, "commercialTemplateUse": true, "prioritySupport": false}',
    true, 1
  ),
  (
    'business', 'Business', 'For studios producing at volume.', 3900, 3200,
    '["Everything in Pro", "25 GB asset storage", "Priority support", "First access: team workspaces, 5 seats (in development)", "First access: CSV batch + dynamic data fields (in development)", "First access: production layers — white ink, foil (in development)"]',
    '{"maxProjects": null, "maxStorageMb": 25000, "maxTeamMembers": 5, "hiResExport": true, "printReadyPdf": true, "svgExport": true, "premiumTemplates": true, "finishes": true, "brandKits": true, "qrAndBarcodes": true, "watermarkedMockups": false, "versionHistory": true, "csvBatch": true, "productionLayers": true, "commercialTemplateUse": true, "prioritySupport": true}',
    false, 2
  ),
  (
    'enterprise', 'Enterprise', 'SSO, API access, and custom workflows.', null, null,
    '["Everything in Business", "Single sign-on (SSO)", "API access & custom integrations", "Private template libraries", "White-label deployment", "Audit logs & custom onboarding"]',
    '{"maxProjects": null, "maxStorageMb": 100000, "maxTeamMembers": 100, "hiResExport": true, "printReadyPdf": true, "svgExport": true, "premiumTemplates": true, "finishes": true, "brandKits": true, "qrAndBarcodes": true, "watermarkedMockups": false, "versionHistory": true, "csvBatch": true, "productionLayers": true, "commercialTemplateUse": true, "prioritySupport": true}',
    false, 3
  )
on conflict (id) do update set
  name = excluded.name,
  blurb = excluded.blurb,
  highlights = excluded.highlights,
  entitlements = excluded.entitlements,
  highlighted = excluded.highlighted,
  sort = excluded.sort;

insert into public.template_categories (id, name, sort) values
  ('minimal-clinical', 'Minimal clinical', 0),
  ('luxury', 'Luxury', 1),
  ('cosmetic-serum', 'Cosmetic serum', 2),
  ('botanical', 'Botanical & organic', 3),
  ('pharma', 'Pharmaceutical-inspired', 4),
  ('apothecary', 'Vintage apothecary', 5),
  ('modern-wellness', 'Modern wellness', 6),
  ('bold-type', 'Bold typography', 7),
  ('qr-first', 'QR-first', 8),
  ('lab', 'Laboratory & research', 9)
on conflict (id) do update set name = excluded.name, sort = excluded.sort;
