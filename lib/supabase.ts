import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

/**
 * Lazy singleton — only creates the client on first use (at request time),
 * so the build doesn't crash when env vars aren't set yet.
 */
function getSupabase(): SupabaseClient {
    if (_supabase) return _supabase;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error(
            'Missing Supabase environment variables. ' +
            'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
        );
    }

    _supabase = createClient(url, key);
    return _supabase;
}

/** Re-export as a Proxy so callers can `import { supabase }` as before. */
export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        return Reflect.get(getSupabase(), prop);
    },
});
