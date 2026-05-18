import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './services/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Grammar from './pages/Grammar'
import Library from './pages/Library'
import Profile from './pages/Profile'
import LoadingSpinner from './components/LoadingSpinner'
import GameHub from './pages/GameHub'
import Quiz from './pages/Quiz.jsx'
import Kanji from './pages/Kanji.jsx'
import QuizManual from './pages/QuizManual.jsx'
import QuizUpload from './pages/QuizUpload.jsx'
import QuizPlay from './pages/QuizPlay.jsx'
import Flashcard from './pages/Flashcard.jsx'
import FlashcardManual from './pages/FlashcardManual.jsx'
import FlashcardPlay from './pages/FlashcardPlay.jsx'
import Analytics from './pages/Analytics.jsx'
import KanjiMinigame from './pages/KanjiMinigame.jsx'

function App() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/grammar" element={<Grammar />} />
        <Route path="/library" element={<Library />} />
        <Route path="/games" element={<GameHub />} />
        <Route path="/games/kanji" element={<KanjiMinigame />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/quiz/manual" element={<QuizManual />} />
        <Route path="/quiz/upload" element={<QuizUpload />} />
        <Route path="/quiz/play" element={<QuizPlay />} />
        <Route path="/flashcard" element={<Flashcard />} />
        <Route path="/flashcard/manual" element={<FlashcardManual />} />
        <Route path="/flashcard/play" element={<FlashcardPlay />} />
        <Route path="/kanji" element={<Kanji />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
