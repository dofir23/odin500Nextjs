require('dotenv').config();

const { createSupabaseClient } = require('./supabaseClient');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseService = createSupabaseClient(supabaseUrl, serviceRoleKey);

module.exports = supabaseService;
