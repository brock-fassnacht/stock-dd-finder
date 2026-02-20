import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import SecTimelinePage from './pages/SecTimelinePage'
import ExecCompPage from './pages/ExecCompPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sec-timeline" element={<SecTimelinePage />} />
        <Route path="/executive-comp" element={<ExecCompPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
