"use client";

import { create } from "zustand";

export type SaveState = "saved" | "dirty" | "saving" | "error";

interface ProjectSessionState {
  projectId: string | null;
  projectName: string;
  saveState: SaveState;
  lastSavedAt: number | null;

  startSession: (projectId: string, projectName: string) => void;
  endSession: () => void;
  setProjectName: (name: string) => void;
  setSaveState: (state: SaveState) => void;
  markSaved: () => void;
}

export const useProjectSessionStore = create<ProjectSessionState>()((set) => ({
  projectId: null,
  projectName: "",
  saveState: "saved",
  lastSavedAt: null,

  startSession: (projectId, projectName) =>
    set({ projectId, projectName, saveState: "saved", lastSavedAt: null }),
  endSession: () =>
    set({ projectId: null, projectName: "", saveState: "saved", lastSavedAt: null }),
  setProjectName: (projectName) => set({ projectName }),
  setSaveState: (saveState) => set({ saveState }),
  markSaved: () => set({ saveState: "saved", lastSavedAt: Date.now() }),
}));
