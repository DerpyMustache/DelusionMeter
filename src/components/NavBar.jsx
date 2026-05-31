import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const location = useLocation();
  const navItems = [
    { path: "/", label: "Profile Data" },
    { path: "/prompts", label: "Prompt Data" },
    { path: "/faq", label: "FAQ" },
  ];
  return (
    <nav className="navbar" style={{ background: "#18181b", padding: "0.5em 0", marginBottom: "2em", boxShadow: "0 2px 8px #0002" }}>
      <ul className="navbar-list" style={{ display: "flex", justifyContent: "center", gap: "2em", listStyle: "none", margin: 0, padding: 0 }}>
        {navItems.map(({ path, label }) => (
          <li key={path}>
            <Link
              to={path}
              style={{
                color: location.pathname === path ? "#fbbf24" : "#a7f3d0",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "1.1em",
                padding: "0.3em 0.7em",
                borderRadius: 6,
                background: location.pathname === path ? "#27272a" : "none",
                transition: "background 0.2s, color 0.2s"
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
