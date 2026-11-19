import { cache } from "react";
import { getMyProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

// The logged-in user's profile for Server Components. cache() runs the query
// once per request, so the app layout (profile chip) and the page (greeting)
// share a single database call. Kept apart from profiles.ts because this
// imports the server client (next/headers), which the proxy can't use.
export const getCurrentProfile = cache(async () => getMyProfile(await createClient()));
