import { RouterProvider, createHashRouter } from 'react-router'
import { Splash } from './components/Splash'
import { Updates } from './components/Updates'
import { JoinPage } from './share/JoinPage'
import { ShareSync } from './share/ShareSync'
import { EncounterPage } from './gm/EncounterPage'
import { CampaignPage, SharedSheetPage } from './gm/Campaigns'
import { GmHome } from './gm/GmHome'
import { RulesPage } from './gm/RulesPage'
import { BookViewer } from './pages/BookViewer'
import { CharacterList } from './pages/CharacterList'
import { Library } from './pages/Library'
import { BuildTab } from './pages/character/BuildTab'
import { CharacterPage } from './pages/character/CharacterPage'
import { EditTab } from './pages/character/EditTab'
import { KarmaTab } from './pages/character/KarmaTab'
import { PlayTab } from './pages/character/PlayTab'
import { SheetTab } from './pages/character/SheetTab'
import { WizardTab } from './pages/character/WizardTab'

// Hash routing works on any static host without server rewrite rules.
const router = createHashRouter([
  { path: '/', element: <CharacterList /> },
  { path: '/library', element: <Library /> },
  { path: '/book/:bookId', element: <BookViewer /> },
  { path: '/gm', element: <GmHome /> },
  { path: '/gm/:id', element: <EncounterPage /> },
  { path: '/gm/campaign/:id', element: <CampaignPage /> },
  { path: '/gm/sheet/:key', element: <SharedSheetPage />, children: [{ index: true, element: <SheetTab /> }] },
  { path: '/join', element: <JoinPage /> },
  { path: '/rules', element: <RulesPage /> },
  {
    path: '/character/:id',
    element: <CharacterPage />,
    children: [
      { index: true, element: <SheetTab /> },
      { path: 'edit', element: <EditTab /> },
      { path: 'build', element: <BuildTab /> },
      { path: 'wizard', element: <WizardTab /> },
      { path: 'play', element: <PlayTab /> },
      { path: 'karma', element: <KarmaTab /> },
    ],
  },
])

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <ShareSync />
      <Splash />
      <div className="print:hidden">
        <Updates />
      </div>
    </>
  )
}
