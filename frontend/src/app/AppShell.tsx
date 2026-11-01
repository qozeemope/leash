import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../shared/ui/Button";
import { CrashNotice } from "../shared/ui/CrashNotice";
import { ErrorBoundary } from "../shared/ui/ErrorBoundary";
import { Logo } from "../shared/ui/Logo";
import { SandboxStrip } from "../shared/ui/SandboxStrip";
import { useAuth } from "../features/auth/AuthContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { Footer } from "./Footer";

export function AppShell() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus();
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <SandboxStrip />
      <header className="masthead">
        <div className="masthead-inner">
          <Logo />
          <div className="masthead-side">
            {user ? (
              <p className="account">
                Signed in as {user.username}
                {user.is_demo ? " (demo)" : ""}{" "}
                <Button
                  size="small"
                  onClick={() => {
                    void signOut().then(() => navigate("/", { replace: true }));
                  }}
                >
                  Sign out
                </Button>
              </p>
            ) : null}
            <nav aria-label="Main">
              <ul className="tabs">
                <li>
                  <NavLink to="/" end>
                    Home
                  </NavLink>
                </li>
                {user ? (
                  <>
                    <li>
                      <NavLink to="/dashboard">Dashboard</NavLink>
                    </li>
                    <li>
                      <NavLink to="/mandates/new">New rule</NavLink>
                    </li>
                  </>
                ) : (
                  <li>
                    <NavLink to="/login">Sign in</NavLink>
                  </li>
                )}
                <li>
                  <NavLink to="/styleguide">Style guide</NavLink>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className="page">
        <Breadcrumbs />
        <ErrorBoundary resetKey={pathname} fallback={(error) => <CrashNotice error={error} />}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
    </>
  );
}
