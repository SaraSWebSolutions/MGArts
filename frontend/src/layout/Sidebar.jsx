import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Scale,
  Gem,
  HandCoins,
  FlaskConical,
  ShoppingCart,
  Hammer,
  Receipt,
  Store,
  Users,
  UserRound,
  Percent,
  ChartNoAxesCombined,
  ShieldCheck,
  KeyRound,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useAuth } from "../context/authContext";

// perm = permission needed to SEE the link (Admin sees everything). Reading is open, so most links are always visible.
const sections = [
  {
    label: "OVERVIEW",
    links: [{ label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" }],
  },
  {
    label: "STOCK",
    links: [
      { label: "Stock Ledger", icon: Scale, to: "/stock" },
      { label: "Jewellery Stock", icon: Gem, to: "/jewellery" },
    ],
  },
  {
    label: "TRANSACTIONS",
    links: [
      { label: "Customer Gold", icon: HandCoins, to: "/gold-receipts" },
      { label: "Gold Conversion", icon: FlaskConical, to: "/conversions" },
      { label: "Add Own Stock", icon: ShoppingCart, to: "/purchases" },
      { label: "Job Work", icon: Hammer, to: "/jobs" },
      { label: "Billing & Payments", icon: Receipt, to: "/billing" },
      { label: "Own Sales", icon: Store, to: "/sales" },
    ],
  },
  {
    label: "MASTERS",
    links: [
      { label: "Customers", icon: Users, to: "/customers" },
      { label: "Workers & Vendors", icon: UserRound, to: "/workers" },
      { label: "Tax Rates", icon: Percent, to: "/tax-rates" },
      {
        label: "Reports",
        icon: ChartNoAxesCombined,
        to: "/reports",
        perm: "reports-view",
      },
    ],
  },
  {
    label: "ADMINISTRATION",
    links: [
      { label: "Users", icon: Users, to: "/users", perm: "users-manage" },
      { label: "Roles", icon: ShieldCheck, to: "/roles", perm: "roles-manage" },
      {
        label: "Permissions",
        icon: KeyRound,
        to: "/permissions",
        perm: "roles-manage",
      },
    ],
  },
];

export default function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) {
  const { role, permissions } = useAuth();
  const isAdmin = role === "Admin";
  const visible = (l) => !l.perm || isAdmin || permissions.includes(l.perm);
  return (
    <>
      <div
        className={`sidebar-scrim ${mobileOpen ? "show" : ""}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={`app-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
      >
        <div className="sidebar-brand">
          <img
            className="brand-circle"
            src="/assets/logo-abbr.png"
            alt="MG Arts"
          />
          <img
            className="brand-wide"
            src="/assets/logo-full.png"
            alt="MG Arts - Gold & Jewellery"
          />
          <button
            className="sidebar-close"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <div className="sidebar-scroll">
          {sections.map((section) => {
            const links = section.links.filter(visible);
            if (!links.length) return null;
            return (
              <div className="nav-section" key={section.label}>
                <span className="section-title">{section.label}</span>
                {links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.label}
                      to={link.to}
                      title={link.label}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `nav-link ${isActive ? "active" : ""}`
                      }
                    >
                      <Icon size={19} />
                      <span>{link.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="sidebar-bottom">
          {(isAdmin || permissions.includes("settings-manage")) && (
            <NavLink
              to="/settings"
              title="Settings"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <Settings2 size={19} />
              <span>Settings</span>
            </NavLink>
          )}
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
            <span>{collapsed ? "Expand" : "Collapse sidebar"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
