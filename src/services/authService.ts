import { useAppStore } from "@/lib/store";
import type { User } from "@/lib/types";
export const authService = {
  async login(username: string, _password: string): Promise<User | null> {
    const u = useAppStore.getState().users.find((x) => x.username === username && x.active !== false);
    return u || useAppStore.getState().users[0];
  },
  async logout() { return true; },
};
