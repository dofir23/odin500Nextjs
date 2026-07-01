require('dotenv').config();

const { createSupabaseClient } = require('./supabaseClient');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

module.exports = supabase;
