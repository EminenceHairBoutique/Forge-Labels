"use client";

import { create } from "zustand";

export type AuthStatus = "local" | "loading" | "signed-out" | "signed-in";

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  isAdmin: boolean;
  setState: (status: AuthStatus, user: AuthUser | null, isAdmin?: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: "local",
  user: null,
  isAdmin: false,
  setState: (status, user, isAdmin = false) => set({ status, user, isAdmin }),
}));
