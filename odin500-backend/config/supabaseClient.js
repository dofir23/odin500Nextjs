const { createClient } = require('@supabase/supabase-js');
const { supabaseFetch } = require('./supabaseFetch');

/**
 * @param {string} url
 * @param {string} key
 * @param {import('@supabase/supabase-js').SupabaseClientOptions} [options]
 */
function createSupabaseClient(url, key, options = {}) {
  if (!url || !key) {
    throw new Error('Supabase URL and key are required');
  }

  const { auth: authOptions, global: globalOptions, ...rest } = options;

  return createClient(url, key, {
    ...rest,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      ...authOptions
    },
    global: {
      fetch: supabaseFetch,
      ...globalOptions
    }
  });
}

module.exports = { createSupabaseClient };
