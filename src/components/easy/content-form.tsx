"use client";

import * as React from "react";
import type { LabelDocument } from "@/lib/document/schema";
import {
  applyEasyChange,
  readEasyState,
  toggleableSlots,
} from "@/lib/easy/fields";
import { SLOTS, SLOT_ORDER, type SlotId } from "@/lib/easy/slots";
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

  return (
    <div className="space-y-4">
      {SLOT_ORDER.map((slot) => {
        const info = SLOTS[slot];
        if (info.kind === "logo") return null;
        const isOn =
          !info.optional || state.enabled.has(slot) || pendingOn.has(slot);
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
      })}
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
