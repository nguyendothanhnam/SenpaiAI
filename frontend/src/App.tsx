import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from './services/auth'
import Layout from './components/Layout'
import Placement from './pages/Placement'
import PlacementGate from './components/placement/PlacementGate'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Grammar from './pages/Grammar'
import Library from './pages/Library'
import Profile from './pages/Profile'
import LoadingSpinner from './components/LoadingSpinner'
import GameHub from './pages/GameHub'
const MiniGame = lazy(() => import('./pages/MiniGame'))
import Quiz from './pages/Quiz.jsx'
import Kanji from './pages/Kanji.jsx'
import QuizManual from './pages/QuizManual.jsx'
import QuizUpload from './pages/QuizUpload.jsx'
import QuizPlay from './pages/QuizPlay.jsx'
import Flashcard from './pages/Flashcard.jsx'
import FlashcardManual from './pages/FlashcardManual.jsx'
import FlashcardPlay from './pages/FlashcardPlay.jsx'
import Analytics from './pages/Analytics.jsx'
import Settings from './pages/Settings'
import GrammarPractice from './pages/GrammarPractice'
import ThemeShop from './pages/ThemeShop'
import DailyChallenge from './pages/DailyChallenge'
import RemindersSettings from './pages/RemindersSettings'
import ListeningLessons from './pages/ListeningLessons'
import ListeningPlayer from './pages/ListeningPlayer'
import InternshipRoleplay from './pages/InternshipRoleplay'
import KanjiLookupScope from './components/kanji/KanjiLookupScope'

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
    <PlacementGate><Layout><KanjiLookupScope>
      <Routes>
        <Route path="/placement" element={<Placement />} />
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:conversationId" element={<Chat />} />
        <Route path="/grammar" element={<Grammar />} />
        <Route path="/grammar/practice" element={<GrammarPractice />} />
        <Route path="/library" element={<Library />} />
        <Route path="/games" element={<GameHub />} />
        <Route path="/games/kanji" element={<Navigate to="/kanji?mode=study" replace />} />
        <Route path="/games/:gameId" element={<Suspense fallback={<LoadingSpinner />}><MiniGame /></Suspense>} />
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
        <Route path="/settings" element={<Settings />} />
        <Route path="/shop" element={<ThemeShop />} />
        <Route path="/daily" element={<DailyChallenge />} />
        <Route path="/settings/reminders" element={<RemindersSettings />} />
        <Route path="/listening" element={<ListeningLessons />} />
        <Route path="/listening/:id" element={<ListeningPlayer />} />
        <Route path="/interview" element={<InternshipRoleplay />} />
        <Route path="/internship" element={<Navigate to="/interview" replace />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </KanjiLookupScope></Layout></PlacementGate>
  )
}

export default App
