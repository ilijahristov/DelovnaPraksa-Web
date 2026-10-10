import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="CoursesHub, почетна">
      <img src="/favicon.svg" alt="" className="h-7 w-7" />
      <span className="text-lg font-semibold tracking-tight text-ink">CoursesHub</span>
    </Link>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex h-full items-center whitespace-nowrap border-b-2 px-1 text-sm ${
    isActive
      ? 'border-brand font-medium text-brand'
      : 'border-transparent text-muted hover:text-ink'
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const links = user && (
    <>
      <NavLink to="/courses" end className={navClass}>
        Курсеви
      </NavLink>
      <NavLink to="/my-courses" className={navClass}>
        Мои курсеви
      </NavLink>
      {user.role === 'PROFESSOR' && (
        <NavLink to="/students" className={navClass}>
          Студенти
        </NavLink>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4">
          <Logo />
          {links && <nav className="hidden h-full gap-6 md:flex">{links}</nav>}
          <div className="ml-auto flex items-center gap-4 text-sm">
            {user ? (
              <>
                <span className="hidden text-right leading-tight sm:block">
                  <span className="block font-medium">{user.name}</span>
                  <span className="block text-xs text-muted">
                    {user.role === 'PROFESSOR' ? 'Професор' : 'Студент'}
                  </span>
                </span>
                <button type="button" onClick={handleLogout} className="btn btn-secondary btn-sm">
                  Одјава
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-brand hover:underline">
                  Најава
                </Link>
                <Link to="/signup" className="btn btn-primary btn-sm">
                  Регистрација
                </Link>
              </>
            )}
          </div>
        </div>
        {links && (
          <nav className="flex h-11 gap-6 overflow-x-auto border-t border-line px-4 md:hidden">
            {links}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-muted">
          <span>CoursesHub</span>
          <span>Студентски проект, не е официјална страница на универзитет.</span>
        </div>
      </footer>
    </div>
  );
}
