const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: { fetch }
});

const isAuthDisabled = () =>
    process.env.AUTH_DISABLED === 'true' || process.env.AUTH_DISABLED === '1';

/**
 * Verify Bearer JWT and attach req.user / req.supabase (RLS-aware client).
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string }>}
 */
async function authenticateRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { ok: false, status: 401, error: 'Unauthorized: No token provided' };
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return { ok: false, status: 401, error: 'Unauthorized: Invalid token' };
    }

    req.user = user;
    req.token = token;
    req.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
        global: {
            fetch,
            headers: { Authorization: `Bearer ${token}` }
        }
    });

    return { ok: true };
}

/** Market/data routes: skip auth when AUTH_DISABLED is set. */
const requireAuth = async (req, res, next) => {
    if (isAuthDisabled()) {
        return next();
    }

    try {
        const result = await authenticateRequest(req);
        if (!result.ok) {
            return res.status(result.status).json({ error: result.error });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/** Watchlists, profile, etc.: always require a valid logged-in user (ignores AUTH_DISABLED). */
const requireAuthStrict = async (req, res, next) => {
    try {
        const result = await authenticateRequest(req);
        if (!result.ok) {
            return res.status(result.status).json({ error: result.error });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = requireAuth;
module.exports.requireAuthStrict = requireAuthStrict;
module.exports.authenticateRequest = authenticateRequest;
module.exports.isAuthDisabled = isAuthDisabled;
