import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './Components/Common/ProtectedRoute'
import PublicOnlyRoute from './Components/Common/PublicOnlyRoute'
import { AuthProvider } from './Context/AuthContext'
import LandingPage from './Pages/Common/LandingPage'
import LoginPage from './Pages/Common/LoginPage'
import RegisterPage from './Pages/Common/RegisterPage'
import UserHomePage from './Pages/User/UserHomePage'
import MyNotesPage from './Pages/Notes/MyNotesPage'
import SemestersPage from './Pages/User/SemestersPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
          <Route path="/user/home" element={<ProtectedRoute><UserHomePage /></ProtectedRoute>} />
          <Route path="/user/semesters" element={<ProtectedRoute><SemestersPage /></ProtectedRoute>} />
          <Route path="/user/notes" element={<ProtectedRoute><MyNotesPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
