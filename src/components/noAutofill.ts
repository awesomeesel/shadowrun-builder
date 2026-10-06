/**
 * Spread on text inputs so password managers leave them alone. Many ignore
 * autocomplete="off" and fill anything labelled "Name", "Gender" or "Age" with
 * the user's identity, so we also use each manager's opt-out attribute and
 * mark free-text fields as search fields, which they skip. Inputs that set
 * their own `type` after the spread (e.g. number) keep it.
 */
export const noAutofill = {
  type: 'search',
  autoComplete: 'off',
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-bwignore': true,
  'data-form-type': 'other',
  'data-protonpass-ignore': 'true',
} as const

/** The same opt-outs for textareas and selects, which have no `type`. */
export const noAutofillField = {
  autoComplete: 'off',
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-bwignore': true,
  'data-form-type': 'other',
  'data-protonpass-ignore': 'true',
} as const

const ATTRIBUTES: [string, string][] = [
  ['autocomplete', 'off'],
  ['data-1p-ignore', 'true'],
  ['data-lpignore', 'true'],
  ['data-bwignore', 'true'],
  ['data-form-type', 'other'],
  ['data-protonpass-ignore', 'true'],
]

function mark(element: Element) {
  for (const [name, value] of ATTRIBUTES) if (!element.hasAttribute(name)) element.setAttribute(name, value)
}

/**
 * Safety net: mark every text field on the page, including ones added later,
 * in case a component forgets to spread `noAutofill`.
 */
export function guardAgainstAutofill(root: HTMLElement = document.body) {
  const selector = 'input:not([type=file]):not([type=checkbox]):not([type=radio]), textarea, select'
  root.querySelectorAll(selector).forEach(mark)
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return
        if (node.matches(selector)) mark(node)
        node.querySelectorAll(selector).forEach(mark)
      })
    }
  }).observe(root, { childList: true, subtree: true })
}
