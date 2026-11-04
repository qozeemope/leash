import { Link } from "react-router-dom";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Leash home">
      <svg
        className="logo-mark"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <circle className="logo-ring" cx="13" cy="19" r="9" />
        <path className="logo-tether" d="M19.5 12.5 L25.5 6.5" />
        <circle className="logo-handle" cx="26" cy="6" r="3.5" />
      </svg>
      <span className="logo-word">Leash</span>
    </Link>
  );
}
