import { RouterProvider, createHashRouter } from 'react-router'
import { BookViewer } from './pages/BookViewer'
import { CharacterList } from './pages/CharacterList'
import { Library } from './pages/Library'
import { BuildTab } from './pages/character/BuildTab'
import { CharacterPage } from './pages/character/CharacterPage'
import { EditTab } from './pages/character/EditTab'
import { SheetTab } from './pages/character/SheetTab'
import { WizardTab } from './pages/character/WizardTab'

// Hash routing works on any static host without server rewrite rules.
const router = createHashRouter([
  { path: '/', element: <CharacterList /> },
  { path: '/library', element: <Library /> },
  { path: '/book/:bookId', element: <BookViewer /> },
  {
    path: '/character/:id',
    element: <CharacterPage />,
    children: [
      { index: true, element: <SheetTab /> },
      { path: 'edit', element: <EditTab /> },
      { path: 'build', element: <BuildTab /> },
      { path: 'wizard', element: <WizardTab /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
