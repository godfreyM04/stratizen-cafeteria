import { createClient } from "@supabase/supabase-js";

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Sanitize URL if it includes the REST API path suffix
if (supabaseUrl.endsWith("/rest/v1/")) {
  supabaseUrl = supabaseUrl.slice(0, -9);
} else if (supabaseUrl.endsWith("/rest/v1")) {
  supabaseUrl = supabaseUrl.slice(0, -8);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase environment variables are missing! Check your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Extract project reference from URL to resolve local storage key dynamically
export const getProjectRef = () => {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    return hostname.split(".")[0];
  } catch (err) {
    return "";
  }
};

export const getAuthTokenKey = () => {
  const ref = getProjectRef();
  return ref ? `sb-${ref}-auth-token` : "";
};


