import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import SecTimelinePage from './pages/SecTimelinePage'
import ExecCompPage from './pages/ExecCompPage'
import BearVsBullPage from './pages/BearVsBullPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/bear-vs-bull" element={<BearVsBullPage />} />
        <Route path="/sec-timeline" element={<SecTimelinePage />} />
        <Route path="/executive-comp" element={<ExecCompPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
