import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export function Footer() {
  const { user } = useAuth();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p>Leash was built for the PayPal AI Hackathon. It uses PayPal sandbox accounts only, so no real money moves.</p>
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            {user ? <Link to="/dashboard">Dashboard</Link> : <Link to="/login">Sign in</Link>}
          </li>
          <li>
            <Link to="/styleguide">Style guide</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
