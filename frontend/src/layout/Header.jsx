import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { fetchData } from "../services/endpoints";
import { money } from "../components/masterHelpers";
export default function Header({ onMenu, dark, setDark }) {
  const { name, role, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchData("/dashboard")
      .then((r) => {
        if (!alive) return;
        const d = r.data || {};
        const a = [];
        if (d.pendingJobs > 0)
          a.push({
            text: `${d.pendingJobs} job(s) with workers waiting for jewellery`,
            to: "/jobs",
          });
        if (d.outstanding > 0)
          a.push({
            text: `Making charges due: ${money(d.outstanding)}`,
            to: "/billing",
          });
        setAlerts(a);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const profileRef = useRef(null);
  const notifRef = useRef(null);
  useEffect(() => {
    const down = (e) => {
      if (!profileRef.current?.contains(e.target)) setProfileOpen(false);
      if (!notifRef.current?.contains(e.target)) setNotificationOpen(false);
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("touchstart", down);
    };
  }, []);
  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setProfileOpen(false);
        setNotificationOpen(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <header className="app-header">
      <div className="header-left">
        <button
          className="icon-button mobile-menu"
          onClick={onMenu}
          aria-label="Open menu"
        >
          <Menu size={21} />
        </button>
        <div className="header-search">
          <Search size={18} />
          <input
            ref={searchRef}
            aria-label="Search workspace"
            placeholder="Search workspace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>Ctrl K</kbd>
          {search && (
            <div className="search-hint">
              Use the page search boxes to filter customers, jobs and stock.
            </div>
          )}
        </div>
      </div>
      <div className="header-right">
        <button
          className="icon-button theme-toggle"
          title={dark ? "Switch to light theme" : "Switch to dark theme"}
          aria-label="Toggle theme"
          onClick={() => setDark(!dark)}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <div className="notification-wrap" ref={notifRef}>
          <button
            className="icon-button notification"
            aria-label="Notifications"
            aria-expanded={notificationOpen}
            onClick={() => {
              setNotificationOpen(!notificationOpen);
              setProfileOpen(false);
            }}
          >
            <Bell size={19} />
            {alerts.length > 0 && <span />}
          </button>
          {notificationOpen && (
            <div className="header-popover">
              <strong>Notifications</strong>
              {alerts.length === 0 ? (
                <p>No new notifications.</p>
              ) : (
                alerts.map((a) => (
                  <p
                    key={a.to}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setNotificationOpen(false);
                      navigate(a.to);
                    }}
                  >
                    {a.text}
                  </p>
                ))
              )}
            </div>
          )}
        </div>
        <div className="profile-wrap" ref={profileRef}>
          <button
            className="profile-button"
            aria-expanded={profileOpen}
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotificationOpen(false);
            }}
          >
            <span className="avatar">
              {(name || "?").charAt(0).toUpperCase()}
            </span>
            <span className="profile-copy">
              <strong>{name || ""}</strong>
              <small>{role || ""}</small>
            </span>
            <ChevronDown size={15} />
          </button>
          {profileOpen && (
            <div className="profile-menu">
              <button
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/profile");
                }}
              >
                <UserRound size={16} /> My profile
              </button>
              <button onClick={logout}>
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
