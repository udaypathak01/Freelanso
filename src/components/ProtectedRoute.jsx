import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../lib/auth';

export default function ProtectedRoute({ children }) {
  const user = auth.getUser();
  const location = useLocation();

  if (!user) {
    // Redirect to login but save the current location to redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
