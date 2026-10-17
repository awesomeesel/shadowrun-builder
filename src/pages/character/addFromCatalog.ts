import type { AddItem } from '../../components/CatalogPicker'
import type { MatrixDevice } from '../../model/character'
import { addDevice } from '../../rules/sr6/matrix'
import type { Update } from './CharacterPage'

/** Append an item picked from the book catalog to the right list. */
export function addFromCatalog(update: Update): AddItem {
  return (list, item) =>
    update((c) => {
      if (list === 'matrixDevices') return { ...c, matrixDevices: addDevice(c.matrixDevices, item as MatrixDevice) }
      return { ...c, [list]: [...c[list], item] }
    })
}
