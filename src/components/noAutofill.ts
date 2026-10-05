/** Spread on inputs so password managers don't offer to fill them (they mistake names for logins). */
export const noAutofill = {
  autoComplete: 'off',
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-bwignore': true,
} as const
