export const DEFAULT_SYNC_ENDPOINT = "https://fxpnnmtlopuunptiaval.supabase.co/functions/v1/workspace-sync";

const configured = (import.meta.env.VITE_WORKSPACE_SYNC_ENDPOINT as string | undefined)?.trim();

export const SYNC_ENDPOINT = (configured || DEFAULT_SYNC_ENDPOINT).replace(/\/+$/, "");

export const IS_LOCAL_DEPLOYMENT = (import.meta.env.VITE_LOCAL_DEPLOYMENT as string | undefined) === "1";
