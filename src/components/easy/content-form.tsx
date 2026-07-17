"use client";

import * as React from "react";
import { ImagePlus, X } from "lucide-react";
import type { LabelDocument } from "@/lib/document/schema";
import {
  applyEasyChange,
  readEasyState,
  toggleableSlots,
} from "@/lib/easy/fields";
import { isResearchIndustry } from "@/lib/easy/industries";
import { fileToEasyLogo } from "@/lib/easy/logo";
import { NOTICE_OPTIONS } from "@/lib/easy/notices";
import { profileFromDoc, saveProfile } from "@/lib/easy/profile";
import { SLOTS, SLOT_ORDER, type SlotId, type SlotSection } from "@/lib/easy/slots";
import { getEasyTemplate } from "@/lib/easy/templates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";

/**
 * The Easy content form (§3 of the brief): type, and the label updates —
 * no clicking text layers. Each field debounces into ONE undoable engine
 * pass; toggles add/remove optional information cleanly (values are
 * stashed and restored). The layout engine handles fitting, reflow, and
 * hiding — the form never shows technical controls.
 */

const DEBOUNCE_MS = 350;

export function ContentForm({ doc }: { doc: LabelDocument }) {
  const state = React.useMemo(() => readEasyState(doc), [doc]);
  // Slots the user switched on but hasn't filled yet (no object exists).
  const [pendingOn, setPendingOn] = React.useState<Set<SlotId>>(new Set());
  const timers = React.useRef(new Map<SlotId, ReturnType<typeof setTimeout>>());
  const notesShown = React.useRef(new Set<string>());

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending.values()) clearTimeout(t);
    };
  }, []);

  // Adjust-during-render: once a pending slot materializes as an object,
  // the document owns its on/off state again (so Simplify can turn it off).
  if (state && [...pendingOn].some((slot) => state.enabled.has(slot))) {
    setPendingOn(new Set([...pendingOn].filter((slot) => !state.enabled.has(slot))));
  }

  if (!state) return null;

  const surfaceNotes = (notes: string[]) => {
    for (const note of notes) {
      if (notesShown.current.has(note)) continue;
      notesShown.current.add(note);
      toast.info("Layout note", note);
    }
    if (notes.length === 0) notesShown.current.clear();
  };

  const commitField = (slot: SlotId, value: string) => {
    const existing = timers.current.get(slot);
    if (existing) clearTimeout(existing);
    timers.current.set(
      slot,
      setTimeout(() => {
        timers.current.delete(slot);
        void applyEasyChange({ field: { slot, value } }).then(surfaceNotes);
      }, DEBOUNCE_MS),
    );
  };

  const toggle = (slot: SlotId, on: boolean) => {
    const hasValue = Boolean(state.fields[slot]?.trim());
    if (on && !hasValue && !state.stash[slot]) {
      // Nothing to materialize yet — reveal the field and wait for input.
      setPendingOn((prev) => new Set(prev).add(slot));
      return;
    }
    setPendingOn((prev) => {
      const next = new Set(prev);
      next.delete(slot);
      return next;
    });
    void applyEasyChange({ toggle: { slot, on } }).then(surfaceNotes);
  };

  const toggleable = new Set(toggleableSlots());
  const logoSrc = state.fields.logo;

  // Only offer fields the CURRENT layout can actually place — no dead
  // inputs. Codes and the logo are engine-level (always placeable).
  const template = getEasyTemplate(state.meta.templateId);
  const supported = new Set<SlotId>([
    ...(template?.rows.map((r) => r.slot) ?? []),
    ...(template?.verticalRow ? [template.verticalRow.slot] : []),
    "qr",
    "barcode",
    "logo",
  ]);
  const research = isResearchIndustry(state.meta.industry);
  const unsupportedWithContent = SLOT_ORDER.filter(
    (slot) =>
      !supported.has(slot) &&
      Boolean(state.fields[slot]?.trim() || state.stash[slot]?.trim()),
  );

  const renderField = (slot: SlotId) => {
    const info = SLOTS[slot];
    const isOn = !info.optional || state.enabled.has(slot) || pendingOn.has(slot);
    const value = state.fields[slot] ?? "";
    return (
      <div key={slot} className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`easy-${slot}`}>{info.label}</Label>
          {info.optional && toggleable.has(slot) && (
            <Switch
              checked={isOn}
              onCheckedChange={(on) => toggle(slot, on)}
              aria-label={`Show ${info.label.toLowerCase()} on the label`}
            />
          )}
        </div>
        {isOn && (
          <>
            {slot === "notice" && (
              <div className="flex flex-wrap gap-1.5 pb-0.5">
                {NOTICE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={state.meta.noticeId === option.id}
                    onClick={() => void applyEasyChange({ noticeId: option.id }).then(surfaceNotes)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] leading-none transition-colors",
                      state.meta.noticeId === option.id
                        ? "border-primary bg-primary-subtle/40 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            )}
            {info.kind === "multiline" ? (
              <FieldTextarea
                id={`easy-${slot}`}
                slot={slot}
                initial={value}
                placeholder={info.placeholder}
                maxLength={info.maxChars}
                onCommit={commitField}
              />
            ) : (
              <FieldInput
                id={`easy-${slot}`}
                slot={slot}
                initial={value}
                placeholder={info.placeholder}
                maxLength={info.maxChars || undefined}
                onCommit={commitField}
              />
            )}
            {info.hint && (
              <p className="text-[11px] leading-snug text-muted-foreground">
                {info.hint}
              </p>
            )}
          </>
        )}
      </div>
    );
  };

  const sectionFields = (section: SlotSection): SlotId[] =>
    SLOT_ORDER.filter(
      (slot) =>
        (SLOTS[slot].section ?? "identity") === section &&
        SLOTS[slot].kind !== "logo" &&
        supported.has(slot),
    );

  const sections: { id: SlotSection; title: string; note?: string }[] = [
    { id: "identity", title: "" },
    {
      id: "science",
      title: "Science data",
      note: "Printed exactly as you type it, from YOUR documentation — Forge Labels cannot verify scientific values.",
    },
    { id: "details", title: "Details" },
    { id: "compliance", title: "Research-use notice" },
    { id: "batch", title: "Catalog & batch" },
    { id: "links", title: "Links & contact" },
    { id: "codes", title: "Codes" },
  ];

  return (
    <div className="space-y-4">
      <LogoField src={logoSrc} onNotes={surfaceNotes} />
      {sections.map(({ id, title, note }) => {
        const fields = sectionFields(id);
        if (fields.length === 0) return null;
        return (
          <React.Fragment key={id}>
            {title && (
              <div className="pt-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {title}
                </p>
                {note && (
                  <p className="mt-0.5 text-[11px] leading-snug text-warning-foreground">
                    {note}
                  </p>
                )}
              </div>
            )}
            {fields.map(renderField)}
          </React.Fragment>
        );
      })}
      {unsupportedWithContent.length > 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          This layout has no spot for{" "}
          {unsupportedWithContent.map((s) => SLOTS[s].label.toLowerCase()).join(", ")}
          {research
            ? " — research layouts in Browse all templates carry them."
            : " — other layouts in Browse all templates carry them."}
        </p>
      )}
      <button
        type="button"
        className="text-left text-xs text-primary underline-offset-2 hover:underline"
        onClick={() => {
          const profile = profileFromDoc(doc);
          const saved = Object.keys(profile);
          if (saved.length === 0) {
            toast.info(
              "Nothing to save yet",
              "Fill in your brand, website, contact, notice, storage, or warning first.",
            );
            return;
          }
          saveProfile(profile);
          toast.success(
            "Company defaults saved",
            `New labels will start with your ${saved
              .map((s) => SLOTS[s as SlotId].label.toLowerCase())
              .join(", ")}.`,
          );
        }}
      >
        Save these as my company defaults
      </button>
    </div>
  );
}

/**
 * Inputs keep local state while typing (so the engine's rebuilds never
 * fight the caret) and resync when the document changes underneath them
 * (undo, template switches) while unfocused.
 */
function FieldInput({
  id,
  slot,
  initial,
  placeholder,
  maxLength,
  onCommit,
}: {
  id: string;
  slot: SlotId;
  initial: string;
  placeholder: string;
  maxLength?: number;
  onCommit: (slot: SlotId, value: string) => void;
}) {
  const [value, setValue] = React.useState(initial);
  const focused = React.useRef(false);

  React.useEffect(() => {
    if (!focused.current) setValue(initial);
  }, [initial]);

  return (
    <Input
      id={id}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
      }}
      onChange={(e) => {
        setValue(e.target.value);
        onCommit(slot, e.target.value);
      }}
    />
  );
}

function FieldTextarea({
  id,
  slot,
  initial,
  placeholder,
  maxLength,
  onCommit,
}: {
  id: string;
  slot: SlotId;
  initial: string;
  placeholder: string;
  maxLength?: number;
  onCommit: (slot: SlotId, value: string) => void;
}) {
  const [value, setValue] = React.useState(initial);
  const focused = React.useRef(false);

  React.useEffect(() => {
    if (!focused.current) setValue(initial);
  }, [initial]);

  return (
    <Textarea
      id={id}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={2}
      className="text-sm"
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
      }}
      onChange={(e) => {
        setValue(e.target.value);
        onCommit(slot, e.target.value);
      }}
    />
  );
}

/**
 * Logo upload (§9 of the brief): PNG/JPG downscaled into the document,
 * placed by the layout engine in the reserved `logo` slot — the rest of
 * the design reflows around it, and removing it is one click (undoable).
 */
function LogoField({
  src,
  onNotes,
}: {
  src: string | undefined;
  onNotes: (notes: string[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const logo = await fileToEasyLogo(file);
      const notes = await applyEasyChange({ logo });
      onNotes(notes);
    } catch (err) {
      toast.error(
        "Couldn't add the logo",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="easy-logo">Logo</Label>
      <div className="flex items-center gap-3">
        {src ? (
          <span className="flex h-12 w-20 items-center justify-center overflow-hidden rounded-md border border-border bg-canvas-backdrop p-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- user upload preview */}
            <img src={src} alt="Your logo" className="max-h-full max-w-full object-contain" />
          </span>
        ) : (
          <span className="flex h-12 w-20 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
            <ImagePlus className="size-4" aria-hidden />
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Adding…" : src ? "Replace logo" : "Add your logo"}
          </Button>
          {src && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => void applyEasyChange({ logo: null }).then(onNotes)}
            >
              <X className="size-3.5" aria-hidden />
              Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        PNG or JPG works best. The design makes room for it automatically.
      </p>
      <input
        ref={inputRef}
        id="easy-logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}
