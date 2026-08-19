import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../utils/api.js";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      register: async ({ name, email, password }) => {
        const { token, user } = await api.register({ name, email, password });
        set({ token, user });
        return user;
      },

      login: async ({ email, password }) => {
        const { token, user } = await api.login({ email, password });
        set({ token, user });
        return user;
      },

      logout: async () => {
        const token = get().token;
        set({ token: null, user: null });
        if (token) {
          // Best-effort: revokes the token server-side (invalidates it even
          // if it leaked) but never blocks the local logout on network state.
          try {
            await api.logout(token);
          } catch {}
        }
      },

      isAuthenticated: () => !!get().token,

      // Re-pulls the current user from the server — used after email
      // verification so an already-logged-in session picks up the change
      // without needing to log out and back in.
      refreshUser: async () => {
        const token = get().token;
        if (!token) return;
        try {
          const { user } = await api.me(token);
          set({ user });
        } catch {}
      },
    }),
    { name: "portfolio-builder:auth" }
  )
);
