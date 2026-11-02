import { X } from "lucide-react";

export function Stat({ icon: Icon, value, label }) {
  return (
    <div className="master-stat">
      <span className="master-stat-icon">
        <Icon size={19} />
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function StatusPill({ active }) {
  return (
    <span className={`status-pill ${active ? "" : "inactive"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function Field({
  label,
  name,
  value = "",
  type = "text",
  required,
  step,
  full,
  placeholder,
  readOnly,
  minLength,
  accept,
  list,
}) {
  const valueProps = type === "file" ? {} : { defaultValue: value ?? "" };
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label>
        {label}
        {required && " *"}
      </label>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        readOnly={readOnly}
        minLength={minLength}
        accept={accept}
        list={list}
        {...valueProps}
      />
    </div>
  );
}

/** options: strings or {value,label}. Pass onChange to make it controlled. */
export function Select({
  label,
  name,
  value,
  options,
  required,
  full,
  placeholder,
  onChange,
}) {
  const opts = options.map((o) =>
    typeof o === "object" ? o : { value: o, label: o },
  );
  const valueProps = onChange
    ? { value: value ?? "", onChange }
    : { defaultValue: value ?? "" };
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label>
        {label}
        {required && " *"}
      </label>
      <select name={name} required={required} {...valueProps}>
        {placeholder && <option value="">{placeholder}</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Drawer({
  title,
  subtitle,
  onClose,
  onSave,
  saving,
  saveLabel = "Save",
  wide,
  children,
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <form
        className="master-drawer"
        style={wide ? { width: "min(680px,96vw)" } : undefined}
        onSubmit={onSave}
      >
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-square" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        <div className="drawer-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button className="primary-btn" disabled={saving}>
            {saving ? "Saving..." : saveLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Row shown inside a table body while loading / when empty. */
export function EmptyRow({ colSpan, loading, text = "No records found" }) {
  return (
    <tr>
      <td colSpan={colSpan} className="master-empty">
        {loading ? "Loading..." : text}
      </td>
    </tr>
  );
}

/** controlled variants - used where the form shows live calculations */
export function CField({
  label,
  value,
  onChange,
  type = "text",
  required,
  step,
  full,
  placeholder,
  readOnly,
  min,
}) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label>
        {label}
        {required && " *"}
      </label>
      <input
        type={type}
        step={step}
        min={min}
        required={required}
        placeholder={placeholder}
        readOnly={readOnly}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}
export function CSelect({
  label,
  value,
  onChange,
  options,
  required,
  full,
  placeholder,
}) {
  const opts = options.map((o) =>
    typeof o === "object" ? o : { value: o, label: o },
  );
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label>
        {label}
        {required && " *"}
      </label>
      <select
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
export function Tabs({ value, onChange, items }) {
  return (
    <div className="tab-bar">
      {items.map((t) => (
        <button
          key={t.value}
          type="button"
          className={value === t.value ? "on" : ""}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
export function Badge({ tone = "blue", children }) {
  return <span className={`tone-badge badge-${tone}`}>{children}</span>;
}
