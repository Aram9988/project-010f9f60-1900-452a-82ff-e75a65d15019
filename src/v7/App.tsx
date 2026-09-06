import { useEffect, useState } from "react";
import OperationalCenter from "../v6/App";
import PrivateWorkspace from "./PrivateWorkspace";

const SESSION_KEY = "command-center-demo-session";

const allowedUsers: Record<string, string> = {
  boss: "المدير",
  "head-studies": "رئيس قسم الدراسات",
  "employee-studies": "مهندس الدراسات",
};

export default function App() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null);

  useEffect(() => {
    const sync = () => setSessionUserId(sessionStorage.getItem(SESSION_KEY));
    sync();
    const timer = window.setInterval(sync, 400);
    window.addEventListener("focus", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const label = sessionUserId ? allowedUsers[sessionUserId] : undefined;

  return (
    <>
      <OperationalCenter />
      {sessionUserId && label && <PrivateWorkspace currentUser={{ id: sessionUserId, label }} />}
    </>
  );
}
