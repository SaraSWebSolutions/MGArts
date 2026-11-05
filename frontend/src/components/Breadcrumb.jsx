import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, House } from "lucide-react";
import "./Breadcrumb.css";

// route -> [section (label, link), page label]. Clicking a section opens its first page.
const SECTIONS = {
  stock: ["Stock", "/stock"],
  transactions: ["Transactions", "/gold-receipts"],
  masters: ["Masters", "/customers"],
  admin: ["Administration", "/users"],
  account: ["Account", "/profile"],
};
const ROUTES = {
  "/dashboard": [null, "Overview"],
  "/stock": ["stock", "Stock Ledger"],
  "/jewellery": ["stock", "Jewellery Stock"],
  "/gold-receipts": ["transactions", "Customer Gold"],
  "/conversions": ["transactions", "Gold Conversion"],
  "/purchases": ["transactions", "Add Own Stock"],
  "/jobs": ["transactions", "Job Work"],
  "/billing": ["transactions", "Billing & Payments"],
  "/sales": ["transactions", "Own Sales"],
  "/customers": ["masters", "Customers"],
  "/workers": ["masters", "Workers & Vendors"],
  "/tax-rates": ["masters", "Tax Rates"],
  "/reports": [null, "Reports"],
  "/settings": [null, "Settings"],
  "/users": ["admin", "Users"],
  "/roles": ["admin", "Roles"],
  "/permissions": ["admin", "Permissions"],
  "/profile": ["account", "My Profile"],
};

/** Home / Section / Page - built from the current route; every part except the last is a link */
export default function Breadcrumb() {
  const { pathname } = useLocation();
  const hit = ROUTES[pathname];
  if (!hit) return null;
  const [sec, label] = hit;
  const crumbs = [{ label: "Home", to: "/dashboard", home: true }];
  if (sec) crumbs.push({ label: SECTIONS[sec][0], to: SECTIONS[sec][1] });
  if (pathname !== "/dashboard") crumbs.push({ label });
  else crumbs.push({ label });

  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <Fragment key={`${c.label}${i}`}>
            {i > 0 && <ChevronRight size={12} className="crumb-sep" />}
            {last ? (
              <span className="crumb-current" aria-current="page">
                {c.label}
              </span>
            ) : (
              <Link to={c.to} className="crumb-link">
                {c.home && <House size={12} />}
                {c.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
