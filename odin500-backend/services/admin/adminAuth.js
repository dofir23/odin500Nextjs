const supabaseService = require('../../config/supabaseService');

async function getUserProfile(userId) {
  const id = String(userId || '').trim();
  if (!id) return null;

  const { data, error } = await supabaseService
    .from('user_profiles')
    .select(
      'id, display_name, is_admin, plan_name, plan_status, plan_renewal_at, phone, updated_at'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function isUserAdmin(userId) {
  const profile = await getUserProfile(userId);
  return Boolean(profile?.is_admin);
}

async function countAdmins() {
  const { count, error } = await supabaseService
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', true);

  if (error) throw error;
  return count || 0;
}

module.exports = {
  getUserProfile,
  isUserAdmin,
  countAdmins
};
