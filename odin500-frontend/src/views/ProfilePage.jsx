'use client';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import {
  changeEmail,
  deleteAccount,
  getUserProfile,
  sendPasswordResetEmail,
  updateUserProfile,
  uploadAvatar
} from '../services/authApi.js';
import { clearApiCache, clearAuthToken } from '../store/apiStore.js';
import {
  mapAboutProfileApiError,
  validateAboutProfile,
  validateAboutProfileField
} from '../utils/aboutProfileValidation.js';

const PROFILE_FIELD_CONFIG = [
  { key: 'displayName', label: 'Name', placeholder: 'Enter name' },
  { key: 'phone', label: 'Phone', placeholder: '+1 555 000 000' },
  { key: 'addressLine1', label: 'Address line 1' },
  { key: 'addressLine2', label: 'Address line 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country', placeholder: 'United States' },
  { key: 'postalCode', label: 'Postal code', placeholder: '10001' }
];

function ProfileFormField({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  readOnly = false,
  placeholder
}) {
  return (
    <label className={'about-field' + (error ? ' about-field--invalid' : '')}>
      <span>{label}</span>
      <div className="about-field__input-wrap">
        <input
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          readOnly={readOnly}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
        />
      </div>
      {error ? (
        <span className="about-field__error" id={`${name}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function initialsFor(name, email) {
  const base = String(name || '').trim() || String(email || '').trim().split('@')[0] || 'U';
  return base
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [profile, setProfile] = useState({
    userEmail: '',
    userName: '',
    displayName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    planName: '',
    planStatus: '',
    planRenewalAt: '',
    avatarUrl: ''
  });
  const [newEmail, setNewEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const p = await getUserProfile();
      setProfile((prev) => ({
        ...prev,
        ...p,
        userName: p.userName || p.displayName || '',
        displayName: p.displayName || p.userName || '',
        avatarUrl: p.avatarUrl || ''
      }));
    } catch (e) {
      setError(e.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const setFieldError = (field, message) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  };

  const validateField = (field, nextProfile = profile) => {
    const message = validateAboutProfileField(field, nextProfile[field], nextProfile);
    setFieldError(field, message);
    return !message;
  };

  const onProfileFieldChange = (field) => (e) => {
    const value = e.target.value;
    const nextProfile = { ...profile, [field]: value };
    setProfile(nextProfile);
    if (fieldErrors[field]) {
      setFieldError(field, validateAboutProfileField(field, value, nextProfile));
    }
    if (field === 'country' && (fieldErrors.postalCode || nextProfile.postalCode)) {
      setFieldError(
        'postalCode',
        validateAboutProfileField('postalCode', nextProfile.postalCode, nextProfile)
      );
    }
  };

  const onProfileFieldBlur = (field) => () => {
    validateField(field);
  };

  const initials = useMemo(
    () => initialsFor(profile.displayName || profile.userName, profile.userEmail),
    [profile.displayName, profile.userEmail, profile.userName]
  );

  const focusFirstInvalidField = (errors) => {
    const firstField = PROFILE_FIELD_CONFIG.find(({ key }) => errors[key])?.key;
    if (!firstField) return;
    requestAnimationFrame(() => {
      document.querySelector(`[name="${firstField}"]`)?.focus();
    });
  };

  const onSaveProfile = async (e) => {
    e.preventDefault();
    const errors = validateAboutProfile(profile);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(errors);
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateUserProfile({
        displayName: profile.displayName,
        phone: profile.phone,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        postalCode: profile.postalCode,
        country: profile.country
      });
      setFieldErrors({});
      setMessage('Profile saved.');
      await loadProfile();
      window.dispatchEvent(new CustomEvent('odin-auth-updated'));
    } catch (e2) {
      const apiFieldError = mapAboutProfileApiError(e2.message);
      if (apiFieldError) {
        setFieldError(apiFieldError.field, apiFieldError.message);
        focusFirstInvalidField({ [apiFieldError.field]: apiFieldError.message });
      } else {
        setError(e2.message || 'Could not save profile');
      }
    } finally {
      setBusy(false);
    }
  };

  const onAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    setError('');
    setMessage('');
    try {
      await uploadAvatar(file);
      setMessage('Avatar updated.');
      await loadProfile();
    } catch (e2) {
      setError(e2.message || 'Could not upload avatar');
    } finally {
      setAvatarBusy(false);
      e.target.value = '';
    }
  };

  const onChangeEmail = async () => {
    setEmailBusy(true);
    setError('');
    setMessage('');
    try {
      await changeEmail(newEmail);
      setMessage('Email change verification sent.');
      setNewEmail('');
    } catch (e) {
      setError(e.message || 'Could not change email');
    } finally {
      setEmailBusy(false);
    }
  };

  const onSendReset = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await sendPasswordResetEmail(`${window.location.origin}/forgot-password`);
      setMessage('Password reset email sent.');
    } catch (e) {
      setError(e.message || 'Could not send password reset');
    } finally {
      setBusy(false);
    }
  };

  const onDeleteAccount = async () => {
    const ok = window.confirm('Delete account permanently? This cannot be undone.');
    if (!ok) return;
    setDeleteBusy(true);
    setError('');
    setMessage('');
    try {
      await deleteAccount();
      clearAuthToken();
      clearApiCache();
      navigate('/signup', { replace: true });
    } catch (e) {
      setError(e.message || 'Could not delete account');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="about-page">
      <h1 className="about-page__title">Your profile</h1>
      {loading ? <div className="about-page__status">Loading profile…</div> : null}
      {error ? <div className="about-page__status about-page__status--err">{error}</div> : null}
      {message ? <div className="about-page__status about-page__status--ok">{message}</div> : null}

      <section className="about-card">
        <h2 className="about-card__title">Profile details</h2>
        <form className="about-profile-grid" onSubmit={onSaveProfile}>
          <div className="about-avatar-block">
            {profile.avatarUrl ? (
              <img className="about-avatar" src={profile.avatarUrl} alt="Profile avatar" />
            ) : (
              <div className="about-avatar about-avatar--fallback">{initials}</div>
            )}
            <label className="about-file-btn">
              {avatarBusy ? 'Uploading…' : 'Upload image'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarPick} hidden />
            </label>
          </div>

          <div className="about-fields">
            {PROFILE_FIELD_CONFIG.map(({ key, label, placeholder }) => (
              <ProfileFormField
                key={key}
                label={label}
                name={key}
                value={profile[key] || ''}
                onChange={onProfileFieldChange(key)}
                onBlur={onProfileFieldBlur(key)}
                error={fieldErrors[key]}
                placeholder={placeholder}
              />
            ))}
            <label className="about-field">
              <span>Email (current)</span>
              <div className="about-field__input-wrap">
                <input value={profile.userEmail || ''} readOnly />
              </div>
            </label>
          </div>

          <div className="about-actions-row">
            <button type="submit" className="about-btn about-btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>

      <section className="about-card">
        <h2 className="about-card__title">Plan details</h2>
        <div className="about-plan-grid">
          <div><strong>Plan:</strong> {profile.planName || 'Free'}</div>
          <div><strong>Status:</strong> {profile.planStatus || 'active'}</div>
          <div><strong>Renewal:</strong> {profile.planRenewalAt || '—'}</div>
        </div>
      </section>

      <section className="about-card">
        <h2 className="about-card__title">Security</h2>
        <div className="about-security-grid">
          <div className="about-security-item">
            <h3>Change email</h3>
            <div className="about-security-row">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new-email@example.com"
              />
              <button
                type="button"
                className="about-btn"
                onClick={onChangeEmail}
                disabled={emailBusy || !newEmail}
              >
                {emailBusy ? 'Sending…' : 'Change email'}
              </button>
            </div>
          </div>
          <div className="about-security-item">
            <h3>Password reset</h3>
            <button type="button" className="about-btn" onClick={onSendReset} disabled={busy}>
              Send reset link
            </button>
          </div>
          <div className="about-security-item about-security-item--danger">
            <h3>Delete account</h3>
            <button type="button" className="about-btn about-btn--danger" onClick={onDeleteAccount} disabled={deleteBusy}>
              {deleteBusy ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </div>
      </section>

      <section className="about-card">
        <h2 className="about-card__title">Legal stuff</h2>
        <div className="about-legal-list">
          <div className="about-legal-item">
            <div>
              <strong>Privacy policy</strong>
              <p>How Odin500 collects, handles and processes user data.</p>
            </div>
            <a className="about-btn" href="#" onClick={(e) => e.preventDefault()}>
              Read privacy policy
            </a>
          </div>
          <div className="about-legal-item">
            <div>
              <strong>Terms & conditions</strong>
              <p>Terms of service regarding the use of this platform.</p>
            </div>
            <a className="about-btn" href="#" onClick={(e) => e.preventDefault()}>
              Read terms & conditions
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
