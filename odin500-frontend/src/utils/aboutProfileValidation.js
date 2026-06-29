const PROFILE_FIELDS = [
  'displayName',
  'phone',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'country',
  'postalCode'
];

const COUNTRY_CODE_MAP = {
  us: 'us',
  usa: 'us',
  'united states': 'us',
  'united states of america': 'us',
  ca: 'ca',
  canada: 'ca',
  gb: 'gb',
  uk: 'gb',
  'united kingdom': 'gb',
  'great britain': 'gb',
  au: 'au',
  australia: 'au',
  de: 'de',
  germany: 'de',
  fr: 'fr',
  france: 'fr',
  in: 'in',
  india: 'in'
};

const PHONE_PATTERN = /^[\d\s()+\-.]{7,24}$/;

function trim(value) {
  return String(value ?? '').trim();
}

function resolveCountryCode(country) {
  const normalized = trim(country).toLowerCase();
  if (!normalized) return '';
  if (COUNTRY_CODE_MAP[normalized]) return COUNTRY_CODE_MAP[normalized];
  if (/^[a-z]{2}$/i.test(normalized)) return normalized.toLowerCase();
  return '';
}

function validateDisplayName(value) {
  const name = trim(value);
  if (!name) return 'Name is required.';
  if (name.length < 2) return 'Name must be at least 2 characters.';
  if (name.length > 80) return 'Name must be 80 characters or fewer.';
  return '';
}

function validatePhone(value) {
  const phone = trim(value);
  if (!phone) return '';
  if (!PHONE_PATTERN.test(phone)) {
    return 'Phone may only include numbers, spaces, and + - ( ).';
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return 'Enter a valid phone number.';
  }
  return '';
}

function validateAddressLine(value, label) {
  const line = trim(value);
  if (!line) return '';
  if (line.length > 120) return `${label} must be 120 characters or fewer.`;
  return '';
}

function validateCity(value) {
  const city = trim(value);
  if (!city) return '';
  if (city.length > 80) return 'City must be 80 characters or fewer.';
  if (!/^[\p{L}\p{M}\s'.-]+$/u.test(city)) {
    return 'City may only include letters, spaces, and . - \'';
  }
  return '';
}

function validateState(value) {
  const state = trim(value);
  if (!state) return '';
  if (state.length > 80) return 'State must be 80 characters or fewer.';
  return '';
}

function validateCountry(value) {
  const country = trim(value);
  if (!country) return '';
  if (country.length > 80) return 'Country must be 80 characters or fewer.';
  return '';
}

function validatePostalCode(value, profile = {}) {
  const postalCode = trim(value);
  if (!postalCode) return '';

  const countryCode = resolveCountryCode(profile.country);
  if (countryCode === 'us' && !/^\d{5}(-\d{4})?$/.test(postalCode)) {
    return 'US postal code must be 5 digits or ZIP+4 (e.g. 10001 or 10001-1234).';
  }
  if (countryCode === 'ca' && !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(postalCode)) {
    return 'Canadian postal code must look like A1A 1A1.';
  }
  if (countryCode === 'gb' && !/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(postalCode)) {
    return 'UK postcode format looks invalid.';
  }
  if (!/^[\dA-Za-z\s-]{3,12}$/.test(postalCode)) {
    return 'Postal code must be 3–12 letters, numbers, spaces, or hyphens.';
  }
  return '';
}

export function validateAboutProfileField(field, value, profile = {}) {
  switch (field) {
    case 'displayName':
      return validateDisplayName(value);
    case 'phone':
      return validatePhone(value);
    case 'addressLine1':
      return validateAddressLine(value, 'Address line 1');
    case 'addressLine2':
      return validateAddressLine(value, 'Address line 2');
    case 'city':
      return validateCity(value);
    case 'state':
      return validateState(value);
    case 'country':
      return validateCountry(value);
    case 'postalCode':
      return validatePostalCode(value, profile);
    default:
      return '';
  }
}

export function validateAboutProfile(profile = {}) {
  const errors = {};
  for (const field of PROFILE_FIELDS) {
    const message = validateAboutProfileField(field, profile[field], profile);
    if (message) errors[field] = message;
  }
  return errors;
}

export function mapAboutProfileApiError(message = '') {
  const text = String(message).trim();
  if (!text) return null;
  if (/display\s*name|displayName/i.test(text)) return { field: 'displayName', message: text };
  if (/phone/i.test(text)) return { field: 'phone', message: text };
  if (/postal|zip/i.test(text)) return { field: 'postalCode', message: text };
  if (/country/i.test(text)) return { field: 'country', message: text };
  if (/city/i.test(text)) return { field: 'city', message: text };
  if (/state/i.test(text)) return { field: 'state', message: text };
  if (/address/i.test(text)) return { field: 'addressLine1', message: text };
  return null;
}
