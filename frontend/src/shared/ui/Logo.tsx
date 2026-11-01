import { Link } from "react-router-dom";

export function Logo() {
  return (
    <Link to="/" className="logo">
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect className="logo-mark-bg" x="1" y="1" width="30" height="30" strokeWidth="2" />
        <path className="logo-mark-l" d="M9 6h5v14h9v5H9z" />
        <circle className="logo-mark-ring" cx="22" cy="10" r="3.5" strokeWidth="2" />
      </svg>
      <span className="logo-word">
        Leash
        <span className="logo-sub">A spending limit for AI shoppers</span>
      </span>
    </Link>
  );
}
