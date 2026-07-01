/**
 * Supabase client for server-side `tickers` reads where full rows (including `id`)
 * must be visible. Uses SUPABASE_SERVICE_ROLE_KEY when set so RLS does not strip `id`.
 * Falls back to the default client (SUPABASE_KEY) if the service role is not configured.
 */
require('dotenv').config();

const { createSupabaseClient } = require('./supabaseClient');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultClient = require('./supabase');

if (supabaseUrl && serviceRoleKey) {
  module.exports = createSupabaseClient(supabaseUrl, serviceRoleKey);
} else {
  module.exports = defaultClient;
}
