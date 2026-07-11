"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createDocument } from "@/lib/document/defaults";
import {
  LABEL_STYLE_LABELS,
  calculateLabel,
  type LabelStyle,
} from "@/lib/geometry/label-calculator";
import { getVialPreset, VIAL_PRESETS } from "@/lib/vials/presets";
import { getStorageAdapter } from "@/lib/storage";
import { parseToMm, formatMm } from "@/lib/geometry/units";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

export function NewLabelDialog({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [presetId, setPresetId] = React.useState("10ml-serum");
  const [style, setStyle] = React.useState<LabelStyle>("full-wrap");
  const [name, setName] = React.useState("");
  const [diameterText, setDiameterText] = React.useState("24.5");
  const [wallText, setWallText] = React.useState("30.0");
  const [creating, setCreating] = React.useState(false);

  const preset = getVialPreset(presetId);
  const isCustom = preset?.isCustom ?? false;

  function applyPreset(id: string) {
    setPresetId(id);
    const p = getVialPreset(id);
    if (p) {
      setStyle(p.defaultLabelStyle);
      setDiameterText(p.diameterMm.toFixed(1));
      setWallText(p.straightWallHeightMm.toFixed(1));
    }
  }

  const diameterMm = parseToMm(diameterText, "mm");
  const wallMm = parseToMm(wallText, "mm");
  const calc =
    diameterMm && wallMm
      ? calculateLabel({
          diameterMm,
          straightWallHeightMm: wallMm,
          style,
          neckDiameterMm: preset?.neckDiameterMm,
          capDiameterMm: preset?.capDiameterMm,
        })
      : null;
  const valid = calc !== null && !calc.issues.some((i) => i.severity === "error");

  async function create() {
    if (!preset || !diameterMm || !wallMm || !valid) return;
    setCreating(true);
    try {
      const doc = createDocument({
        preset,
        style,
        diameterMm,
        straightWallHeightMm: wallMm,
      });
      const project = await getStorageAdapter().createProject({
        name: name.trim() || `${preset.name} label`,
        doc,
      });
      router.push(`/editor/${project.id}`);
    } catch (err) {
      toast.error(
        "Couldn't create the project",
        err instanceof Error ? err.message : undefined,
      );
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" aria-hidden />
            New label
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New label project</DialogTitle>
          <DialogDescription>
            Pick your vial and label style — the canvas is sized from the real
            measurements. You can adjust everything later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Project name</Label>
            <Input
              id="new-name"
              placeholder="e.g. AURELIS Serum No. 4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-preset">Vial</Label>
              <Select value={presetId} onValueChange={applyPreset}>
                <SelectTrigger id="new-preset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIAL_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-style">Label style</Label>
              <Select value={style} onValueChange={(v) => setStyle(v as LabelStyle)}>
                <SelectTrigger id="new-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LABEL_STYLE_LABELS) as LabelStyle[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {LABEL_STYLE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-diameter">Body diameter (mm)</Label>
              <Input
                id="new-diameter"
                inputMode="decimal"
                value={diameterText}
                onChange={(e) => setDiameterText(e.target.value)}
                aria-invalid={diameterMm === null}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-wall">Straight wall (mm)</Label>
              <Input
                id="new-wall"
                inputMode="decimal"
                value={wallText}
                onChange={(e) => setWallText(e.target.value)}
                aria-invalid={wallMm === null}
              />
            </div>
          </div>

          {isCustom && (
            <p className="text-xs text-muted-foreground">
              Measure your container&apos;s diameter and the height of its straight
              cylindrical wall. See the{" "}
              <a
                href="/guides/vial-sizes"
                className="text-primary underline-offset-2 hover:underline"
              >
                measuring guide
              </a>
              .
            </p>
          )}

          <div className="rounded-lg border border-border bg-subtle px-4 py-3 text-sm">
            {valid && calc ? (
              <p>
                Label canvas:{" "}
                <strong className="font-medium tabular-nums">
                  {formatMm(calc.widthMm, "mm", { suffix: false })} ×{" "}
                  {formatMm(calc.heightMm, "mm")}
                </strong>
                {calc.panels === 2 && " · 2 panels"} · {calc.bleedMm} mm bleed ·{" "}
                {calc.safeMm} mm safe zone
              </p>
            ) : (
              <p className="text-destructive">
                {calc?.issues.find((i) => i.severity === "error")?.message ??
                  "Enter valid measurements."}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <a
            href="/templates"
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            Or start from a template
          </a>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!valid} loading={creating}>
              Create &amp; open editor
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
