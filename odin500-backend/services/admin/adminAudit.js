const supabaseService = require('../../config/supabaseService');

async function logAdminAction({ adminId, action, targetUserId = null, targetAccountId = null, metadata = {} }) {
  const row = {
    admin_id: String(adminId),
    action: String(action || '').trim(),
    target_user_id: targetUserId ? String(targetUserId) : null,
    target_account_id: targetAccountId ? String(targetAccountId) : null,
    metadata: metadata && typeof metadata === 'object' ? metadata : {}
  };

  const { error } = await supabaseService.from('admin_audit_log').insert(row);
  if (error) {
    console.warn('[admin-audit] failed to write log:', error.message);
  }
}

module.exports = { logAdminAction };
