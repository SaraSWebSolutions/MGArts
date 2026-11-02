/** API status can be 1/0, "1"/"0", true/false or "active". */

export const isActive = (v) =>
  v === 1 || v === "1" || v === true || String(v).toLowerCase() === "active";

export const STATUS_OPTIONS = [
  { value: "1", label: "Active" },
  { value: "0", label: "Inactive" },
];

/** Plain object from a <form>; File inputs left empty are dropped. */
export const formValues = (form) => {
  const out = {};
  new FormData(form).forEach((value, key) => {
    if (value instanceof File && value.size === 0) return;
    out[key] = value;
  });
  return out;
};

export const imageUrl = (v) =>
  typeof v === "string" && /^(https?:|data:)/.test(v) ? v : null;

export const PURITIES = [
  { value: "999", label: "24K · 999" },
  { value: "916", label: "22K · 916" },
  { value: "875", label: "21K · 875" },
  { value: "750", label: "18K · 750" },
];
export const karat = (p) =>
  ({ 999: "24K", 916: "22K", 875: "21K", 750: "18K", 585: "14K" })[Number(p)] ||
  "";
export const wt = (n) =>
  `${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;
export const money = (n) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const dt = (v) =>
  v
    ? new Date(v).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
export const today = () => new Date().toISOString().slice(0, 10);
export const OWNER_LABEL = { own: "Own stock", customer: "Customer stock" };
export const clean = (o) =>
  Object.fromEntries(
    Object.entries(o).filter(
      ([, v]) => v !== "" && v !== undefined && v !== null,
    ),
  );
export const opts = (rows, label = (r) => r.name) =>
  rows
    .filter((r) => isActive(r.status ?? 1))
    .map((r) => ({ value: r.id, label: label(r) }));
