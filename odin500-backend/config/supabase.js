require('dotenv').config();

const { createSupabaseClient } = require('./supabaseClient');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

/**
 * Creates a brand-new Supabase client for a single stateful auth call
 * (signIn/signOut/signUp/refreshSession/verifyOtp/...).
 *
 * These methods read/write the client's own in-memory "current session"
 * instead of taking a session as an argument, so sharing one client across
 * concurrent requests lets User A's request overwrite/consume User B's
 * session (e.g. a stray signOut() revoking whichever session happened to be
 * stored at that moment). A fresh client per call keeps each request's
 * session isolated.
 */
function createAuthClient() {
    return createSupabaseClient(supabaseUrl, supabaseKey);
}

module.exports = supabase;
module.exports.createAuthClient = createAuthClient;
