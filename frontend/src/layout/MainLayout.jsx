import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import "./layout.css";
export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("mg-sidebar-collapsed") === "true",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("mg-theme") === "dark",
  );
  const toggleCollapsed = (value) => {
    setCollapsed(value);
    localStorage.setItem("mg-sidebar-collapsed", String(value));
  };
  const toggleDark = (value) => {
    setDark(value);
    localStorage.setItem("mg-theme", value ? "dark" : "light");
  };
  return (
    <div
      className={`app-shell ${collapsed ? "is-collapsed" : ""} ${dark ? "theme-dark" : ""}`}
    >
      <Sidebar
        collapsed={collapsed}
        setCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="app-main">
        <Header
          onMenu={() => setMobileOpen(true)}
          dark={dark}
          setDark={toggleDark}
        />
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          © {new Date().getFullYear()} MG Arts{" "}
          <span>Gold & Jewellery Management</span>
        </footer>
      </div>
    </div>
  );
}
