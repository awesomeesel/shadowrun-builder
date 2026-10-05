import { RouterProvider, createHashRouter } from 'react-router'
import { CharacterEditor } from './pages/CharacterEditor'
import { CharacterList } from './pages/CharacterList'

// Hash routing works on any static host without server rewrite rules.
const router = createHashRouter([
  { path: '/', element: <CharacterList /> },
  { path: '/character/:id', element: <CharacterEditor /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
