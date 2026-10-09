import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './auth';
import { Layout } from './components/Layout';
import { EmptyState, LoadingState } from './components/ui';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { CourseFormPage } from './pages/CourseFormPage';
import { CoursesPage } from './pages/CoursesPage';
import { LoginPage } from './pages/LoginPage';
import { MyCoursesPage } from './pages/MyCoursesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SignupPage } from './pages/SignupPage';
import { StudentsPage } from './pages/StudentsPage';

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

// UI convenience only: the API enforces roles itself.
function RequireProfessor() {
  const { user } = useAuth();
  if (user?.role !== 'PROFESSOR') {
    return (
      <EmptyState title="Немате пристап">Оваа страница е достапна само за професори.</EmptyState>
    );
  }
  return <Outlet />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (user) return <Navigate to="/courses" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="/signup" element={<GuestOnly><SignupPage /></GuestOnly>} />
            <Route element={<RequireAuth />}>
              <Route index element={<Navigate to="/courses" replace />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/courses/:id" element={<CourseDetailPage />} />
              <Route path="/my-courses" element={<MyCoursesPage />} />
              <Route element={<RequireProfessor />}>
                <Route path="/courses/new" element={<CourseFormPage />} />
                <Route path="/courses/:id/edit" element={<CourseFormPage />} />
                <Route path="/students" element={<StudentsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
