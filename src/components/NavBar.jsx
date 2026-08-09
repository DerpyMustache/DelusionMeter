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
                  color: location.pathname === path ? "#ffd0ef" : "#ffc0e5",
                  background: location.pathname === path ? "linear-gradient(180deg, #6b2f83 0%, #4d1f65 100%)" : "none",
                  borderColor: location.pathname === path ? "rgba(255, 184, 232, 0.7)" : "transparent",
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
