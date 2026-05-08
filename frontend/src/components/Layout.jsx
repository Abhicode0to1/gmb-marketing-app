import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Search, Users, Kanban, Megaphone, Inbox, BarChart3, LogOut, Settings,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/extractor", icon: Search, label: "GMB Extractor" },
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/pipeline", icon: Kanban, label: "Pipeline" },
  { to: "/campaigns", icon: Megaphone, label: "Campaigns" },
  { to: "/inbox", icon: Inbox, label: "Inbox" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout() {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-blue-600 leading-tight">GMB Marketing</h1>
          <p className="text-xs text-gray-400">Lead Generation CRM</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
