import { RouterProvider, createHashRouter } from 'react-router'
import { CharacterList } from './pages/CharacterList'
import { CharacterPage } from './pages/character/CharacterPage'
import { EditTab } from './pages/character/EditTab'
import { SheetTab } from './pages/character/SheetTab'

// Hash routing works on any static host without server rewrite rules.
const router = createHashRouter([
  { path: '/', element: <CharacterList /> },
  {
    path: '/character/:id',
    element: <CharacterPage />,
    children: [
      { index: true, element: <SheetTab /> },
      { path: 'edit', element: <EditTab /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
