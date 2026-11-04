import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, ButtonLink } from "../shared/ui/Button";
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
          <nav className="mainnav" aria-label="Main">
            <ul className="tabs">
              <li>
                <NavLink to="/" end>
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink to="/how-it-works">How it works</NavLink>
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
              ) : null}
            </ul>
          </nav>
          <div className="account">
            {user ? (
              <>
                <span className="account-name">
                  {user.username}
                  {user.is_demo ? " (demo)" : ""}
                </span>
                <Button
                  size="small"
                  onClick={() => {
                    void signOut().then(() => navigate("/", { replace: true }));
                  }}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <ButtonLink to="/login" size="small">
                Sign in
              </ButtonLink>
            )}
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
