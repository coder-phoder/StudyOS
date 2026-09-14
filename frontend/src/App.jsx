import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/Common/ProtectedRoute'
import PublicOnlyRoute from './components/Common/PublicOnlyRoute'
import { AuthProvider } from './context/AuthContext'
import LandingPage from './pages/Common/LandingPage'
import LoginPage from './pages/Common/LoginPage'
import RegisterPage from './pages/Common/RegisterPage'
import UserHomePage from './pages/User/UserHomePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
          <Route path="/user/home" element={<ProtectedRoute><UserHomePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
