import { Navigate } from 'react-router-dom';
import { isLoggedIn, getRole } from '../utils/auth';

export default function ProtectedRoute({ children, allowedRoles }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  const role = getRole();
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
