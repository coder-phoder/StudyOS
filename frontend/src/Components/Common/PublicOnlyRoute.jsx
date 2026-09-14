import { Navigate } from 'react-router-dom'
import { useAuth } from '../../Context/AuthContext'
import LoadingScreen from './LoadingScreen'

export default function PublicOnlyRoute({ children }) {
  const { user, isLoadingSession } = useAuth()

  if (isLoadingSession) {
    return <LoadingScreen />
  }

  return user ? <Navigate to="/user/home" replace /> : children
}
