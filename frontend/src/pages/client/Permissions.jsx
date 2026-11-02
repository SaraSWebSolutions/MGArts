import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { permissionsApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { Drawer, EmptyRow, Field, Stat } from "../../components/MasterUI";
import { formValues } from "../../components/masterHelpers";
import "./Masters.css";

export default function Permissions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows(await permissionsApi.list());
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load permissions"));
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
  // useEffect(() => {
  //   load();
  // }, [load]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
      void Promise.resolve().then(load);
    }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        `${r.name}${r.description ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      ),
    [rows, q],
  );

  const save = async (e) => {
    e.preventDefault();
    const f = formValues(e.currentTarget);
    const payload = { description: f.description.trim() };
    // only send the name when it changed (avoids "name already taken" on the record itself)
    if (!editing.id || f.name.trim() !== editing.name)
      payload.name = f.name.trim();
    setSaving(true);
    try {
      if (editing.id) await permissionsApi.update(editing.id, payload);
      else await permissionsApi.create(payload);
      toast.success(editing.id ? "Permission updated" : "Permission created");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save permission"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete permission "${r.name}"?`)) return;
    try {
      await permissionsApi.remove(r.id);
      toast.success("Permission deleted");
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete permission"));
    }
  };

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <span className="master-eyebrow">ADMINISTRATION / PERMISSIONS</span>
          <h1>Permissions</h1>
          <p>Define the actions that can be granted to roles.</p>
        </div>
        <button className="primary-btn" onClick={() => setEditing({})}>
          <Plus size={16} /> Add Permission
        </button>
      </header>

      <div className="master-stats">
        <Stat icon={KeyRound} value={rows.length} label="Permissions" />
      </div>

      <section className="master-card">
        <div className="master-toolbar">
          <div className="master-search">
            <Search size={15} />
            <input
              placeholder="Search permission..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>Permission</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <EmptyRow colSpan={3} loading={loading} />
              )}
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="name-cell">
                      <span className="row-icon">
                        <KeyRound size={16} />
                      </span>
                      <div>
                        <strong>{r.name}</strong>
                      </div>
                    </div>
                  </td>
                  <td>{r.description || "—"}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="master-footer">
          {filtered.length} of {rows.length} permissions
        </div>
      </section>

      {editing && (
        <Drawer
          title={editing.id ? "Edit Permission" : "Add Permission"}
          subtitle="Access control"
          onClose={() => setEditing(null)}
          onSave={save}
          saving={saving}
          saveLabel="Save Permission"
        >
          <Field
            label="Name"
            name="name"
            value={editing.name}
            placeholder="e.g. report-view"
            required
            full
          />
          <Field
            label="Description"
            name="description"
            value={editing.description}
            full
          />
        </Drawer>
      )}
    </div>
  );
}
