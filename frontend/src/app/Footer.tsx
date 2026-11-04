import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export function Footer() {
  const { user } = useAuth();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p>
          Leash is a hackathon project for the PayPal AI Hackathon. Payments run on PayPal sandbox accounts and no real
          money moves.
        </p>
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/how-it-works">How it works</Link>
          </li>
          <li>{user ? <Link to="/dashboard">Dashboard</Link> : <Link to="/login">Sign in</Link>}</li>
        </ul>
      </div>
    </footer>
  );
}
