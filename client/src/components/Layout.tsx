import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="CoursesHub, почетна">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#f6f2ea" fillOpacity="0.08" />
        <rect x="7" y="8" width="18" height="4" rx="1.5" fill="#e3a53b" />
        <rect x="9" y="14" width="16" height="4" rx="1.5" fill="#f6f2ea" />
        <rect x="7" y="20" width="14" height="4" rx="1.5" fill="#3fb3a8" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight text-paper">
        Courses<span className="text-amber">Hub</span>
      </span>
    </Link>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap border-b-2 px-1 py-1 text-sm font-medium transition-colors ${
    isActive ? 'border-amber text-paper' : 'border-transparent text-paper/70 hover:text-paper'
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-ink text-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
          <Logo />
          {user ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-right leading-tight sm:block">
                <span className="block font-medium">{user.name}</span>
                <span className="block text-xs text-paper/60">
                  {user.role === 'PROFESSOR' ? 'Професор' : 'Студент'}
                </span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-paper/25 px-3 py-1.5 text-xs font-semibold hover:bg-paper/10"
              >
                Одјава
              </button>
            </div>
          ) : (
            <nav className="flex items-center gap-4 text-sm">
              <NavLink to="/login" className={navClass}>
                Најава
              </NavLink>
              <NavLink to="/signup" className={navClass}>
                Регистрација
              </NavLink>
            </nav>
          )}
          {user && (
            <nav className="-mb-3 flex w-full gap-5 overflow-x-auto pb-2" aria-label="Главна навигација">
              <NavLink to="/courses" end className={navClass}>
                Курсеви
              </NavLink>
              <NavLink to="/my-courses" className={navClass}>
                Мои курсеви
              </NavLink>
              {user.role === 'PROFESSOR' && (
                <>
                  <NavLink to="/courses/new" className={navClass}>
                    Нов курс
                  </NavLink>
                  <NavLink to="/students" className={navClass}>
                    Студенти
                  </NavLink>
                </>
              )}
            </nav>
          )}
        </div>
        <div className="h-1 bg-gradient-to-r from-amber via-teal-light to-teal-deep" />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-ink/10 bg-paper-deep">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-ink-soft">
          <span className="font-display font-semibold text-ink">CoursesHub</span>
          <span>Студентски проект, не е официјална страница на универзитет.</span>
        </div>
      </footer>
    </div>
  );
}
