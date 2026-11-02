import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { getErrorMessage } from "../services/api";
import { useAuth } from "../context/authContext";
import { useList } from "../hooks";
import { Drawer, EmptyRow, Field, Select, Stat, StatusPill } from "./MasterUI";
import { STATUS_OPTIONS, formValues, isActive } from "./masterHelpers";
import "../pages/client/Masters.css";

/**
 * Config-driven master screen (same look as the Units / Lines pages).
 * fields: [{ name, label, type: text|number|select, options, required, full, placeholder, def }]
 * columns: [{ label, render(row) }]   primary(row) -> { title, sub }
 */
export default function MasterPage({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  api,
  perm,
  addLabel,
  primary,
  columns,
  fields,
  search,
  stats = () => [],
  note,
}) {
  const { can } = useAuth();
  const { rows, loading, reload } = useList(() => api.list(), []);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const allowed = can(perm);

  const filtered = useMemo(
    () => rows.filter((r) => search(r).toLowerCase().includes(q.toLowerCase())),
    [rows, q, search],
  );

  const save = async (e) => {
    e.preventDefault();
    const f = formValues(e.currentTarget);
    const payload = {};
    fields.forEach((fl) => {
      let v = f[fl.name];
      if (v === undefined) return;
      if (fl.type === "number" || fl.name === "status") v = Number(v);
      else if (typeof v === "string") v = v.trim();
      payload[fl.name] = v;
    });
    if (f.status !== undefined) payload.status = Number(f.status); // Active = 1, Inactive = 0 (the Status select is not part of `fields`)
    setSaving(true);
    try {
      if (editing.id) await api.update(editing.id, payload);
      else await api.create(payload);
      toast.success(editing.id ? "Saved" : "Created");
      setEditing(null);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete ${primary(r).title}?`)) return;
    try {
      await api.remove(r.id);
      toast.success("Deleted");
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete"));
    }
  };

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <span className="master-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {allowed && (
          <button className="primary-btn" onClick={() => setEditing({})}>
            <Plus size={16} /> {addLabel}
          </button>
        )}
      </header>
      <div className="master-stats">
        <Stat icon={Icon} value={rows.length} label={`Total ${title}`} />
        <Stat
          icon={Icon}
          value={rows.filter((r) => isActive(r.status)).length}
          label="Active"
        />
        {stats(rows).map((s) => (
          <Stat
            key={s.label}
            icon={s.icon || Icon}
            value={s.value}
            label={s.label}
          />
        ))}
      </div>
      <section className="master-card">
        <div className="master-toolbar">
          <div className="master-search">
            <Search size={15} />
            <input
              placeholder="Search..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>{columns[0].label}</th>
                {columns.slice(1).map((c) => (
                  <th key={c.label}>{c.label}</th>
                ))}
                <th>Status</th>
                {allowed && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <EmptyRow colSpan={columns.length + 2} loading={loading} />
              )}
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="name-cell">
                      <span className="row-icon">
                        <Icon size={16} />
                      </span>
                      <div>
                        <strong>{primary(r).title}</strong>
                        <small>{primary(r).sub}</small>
                      </div>
                    </div>
                  </td>
                  {columns.slice(1).map((c) => (
                    <td key={c.label}>{c.render(r)}</td>
                  ))}
                  <td>
                    <StatusPill active={isActive(r.status)} />
                  </td>
                  {allowed && (
                    <td>
                      <div className="action-buttons">
                        <button
                          className="icon-square"
                          title="Edit"
                          onClick={() => setEditing(r)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="icon-square danger"
                          title="Delete"
                          onClick={() => remove(r)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="master-footer">
          Showing {filtered.length} of {rows.length}
        </div>
      </section>

      {editing && (
        <Drawer
          title={editing.id ? `Edit ${primary(editing).title}` : addLabel}
          subtitle={subtitle}
          onClose={() => setEditing(null)}
          onSave={save}
          saving={saving}
        >
          {fields.map((fl) =>
            fl.type === "select" ? (
              <Select
                key={fl.name}
                label={fl.label}
                name={fl.name}
                value={String(editing[fl.name] ?? fl.def ?? "")}
                options={fl.options}
                required={fl.required}
                full={fl.full}
              />
            ) : (
              <Field
                key={fl.name}
                label={fl.label}
                name={fl.name}
                type={fl.type || "text"}
                step={fl.step}
                value={editing[fl.name] ?? fl.def ?? ""}
                required={fl.required}
                full={fl.full}
                placeholder={fl.placeholder}
              />
            ),
          )}
          <Select
            label="Status"
            name="status"
            value={editing.id ? (isActive(editing.status) ? "1" : "0") : "1"}
            options={STATUS_OPTIONS}
          />
          {note && <div className="master-note">{note}</div>}
        </Drawer>
      )}
    </div>
  );
}
