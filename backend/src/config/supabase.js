import { createClient } from '@supabase/supabase-js';

let _supabase;

// Internal helper to get/init client
function getClient() {
    if (!_supabase) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in process.env');
        }
        _supabase = createClient(supabaseUrl, supabaseKey);
    }
    return _supabase;
}

// Export a Proxy that behaves like the supabase client but initializes on first access
export const supabase = new Proxy({}, {
    get(target, prop) {
        return getClient()[prop];
    },
    // Standard apply/construct traps aren't needed for the supabase client object
});
