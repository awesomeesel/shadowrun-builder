import type { AddItem } from '../../components/CatalogPicker'
import type { Update } from './CharacterPage'

/** Append an item picked from the book catalog to the right list. */
export function addFromCatalog(update: Update): AddItem {
  return (list, item) =>
    update((c) => {
      // The first device becomes the one used for Matrix stats.
      const added =
        list === 'matrixDevices' && !c.matrixDevices.some((d) => d.active) ? { ...item, active: true } : item
      return { ...c, [list]: [...c[list], added] }
    })
}
