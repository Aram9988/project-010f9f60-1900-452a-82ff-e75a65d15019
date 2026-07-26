import { useEffect } from "react";
import { useSession } from "@/lib/store";

export function ThemeInit() {
  const theme = useSession((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);
  return null;
}