import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const location = useLocation();
  const navItems = [
    { path: "/", label: "Delusion Meter" },
    { path: "/prompts", label: "Prompt Data" },
    { path: "/faq", label: "FAQ" },
  ];
  return (
    <nav className="navbar">
      <ul className="navbar-list">
        {navItems.map(({ path, label }) => (
          <li key={path}>
            <Link
              to={path}
              className="navbar-link"
              style={{
                color: location.pathname === path ? "#fbbf24" : "#a7f3d0",
                background: location.pathname === path ? "#27272a" : "none",
              }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
