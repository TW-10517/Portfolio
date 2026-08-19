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

      logout: () => set({ token: null, user: null }),

      isAuthenticated: () => !!get().token,
    }),
    { name: "portfolio-builder:auth" }
  )
);
