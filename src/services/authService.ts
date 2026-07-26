import { users } from "@/lib/mock/seed";
import type { User } from "@/lib/types";
export const authService = {
  async login(username: string, _password: string): Promise<User | null> {
    const u = users.find((x) => x.username === username);
    return u || users[0];
  },
  async logout() { return true; },
};