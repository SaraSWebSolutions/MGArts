import { useEffect, useState } from "react";
import {
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  KeyRound,
} from "lucide-react";
import toast from "react-hot-toast";
import { permissionsApi, rolesApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { Drawer, EmptyRow, Field, Stat } from "../../components/MasterUI";
import { formValues } from "../../components/masterHelpers";
import { Skeleton } from "../../components/Loaders";
import Pagination from "../../components/Pagination";
import { usePaged } from "../../hooks";
import Breadcrumb from "../../components/Breadcrumb";
import "./Masters.css";

/** Tick the permissions a role should have, then save them with POST /roles/:id/permissions */
function RolePermissions({ role, onClose }) {
  const [all, setAll] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([permissionsApi.list(), rolesApi.permissions(role.id)])
      .then(([everything, assigned]) => {
        if (!alive) return;
        setAll(everything);
        setSelected(
          new Set(
            assigned.map((p) => String(typeof p === "object" ? p.id : p)),
          ),
        );
      })
      .catch((err) =>
        toast.error(getErrorMessage(err, "Failed to load permissions")),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [role.id]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await rolesApi.assignPermissions(role.id, [...selected].map(Number));
      toast.success("Permissions updated");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update permissions"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={`Permissions · ${role.name}`}
      subtitle={`${selected.size} selected`}
      onClose={onClose}
      onSave={save}
      saving={saving || loading}
      saveLabel="Save Permissions"
    >
      {loading && (
        <div style={{ gridColumn: "1/-1" }} aria-busy="true">
          {[90, 70, 82, 60, 76, 66].map((w, i) => (
            <Skeleton key={i} width={`${w}%`} height={14} style={{ marginTop: i ? 20 : 0 }} />
          ))}
        </div>
      )}
      {!loading && all.length === 0 && (
        <div className="master-empty" style={{ gridColumn: "1/-1" }}>
          No permissions defined yet
        </div>
      )}
      {all.map((p) => (
        <label
          key={p.id}
          style={{
            display: "flex",
            gap: 9,
            alignItems: "center",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={selected.has(String(p.id))}
            onChange={() => toggle(String(p.id))}
          />
          <span>
            <strong style={{ display: "block" }}>{p.name}</strong>
            {p.description && (
              <small style={{ color: "var(--muted)" }}>{p.description}</small>
            )}
          </span>
        </label>
      ))}
    </Drawer>
  );
}

export default function Roles() {
  const {
    rows,
    meta,
    summary,
    loading,
    reload: load,
    setPage,
    limit,
    setLimit,
    q,
    setQ,
  } = usePaged((p) => rolesApi.page(p), []);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    const f = formValues(e.currentTarget);
    const payload = { description: f.description.trim() };
    if (!editing.id || f.name.trim() !== editing.name)
      payload.name = f.name.trim();
    setSaving(true);
    try {
      if (editing.id) await rolesApi.update(editing.id, payload);
      else await rolesApi.create(payload);
      toast.success(editing.id ? "Role updated" : "Role created");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save role"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete role "${r.name}"?`)) return;
    try {
      await rolesApi.remove(r.id);
      toast.success("Role deleted");
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete role"));
    }
  };

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <Breadcrumb />
          <h1>Roles</h1>
          <p>Create roles and choose which permissions each role has.</p>
        </div>
        <button className="primary-btn" onClick={() => setEditing({})}>
          <Plus size={16} /> Add Role
        </button>
      </header>

      <div className="master-stats">
        <Stat
          icon={ShieldCheck}
          loading={!summary}
          value={summary?.total ?? 0}
          label="Roles"
        />
      </div>

      <section className="master-card">
        <div className="master-toolbar">
          <div className="master-search">
            <Search size={15} />
            <input
              placeholder="Search role..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow colSpan={3} loading={loading} rows={limit} />
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="name-cell">
                      <span className="row-icon">
                        <ShieldCheck size={16} />
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
                        title="Permissions"
                        onClick={() => setAssigning(r)}
                      >
                        <KeyRound size={14} />
                      </button>
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
        <Pagination
          meta={meta}
          loading={loading}
          limit={limit}
          onPage={setPage}
          onLimit={setLimit}
          label="roles"
        />
      </section>

      {editing && (
        <Drawer
          title={editing.id ? "Edit Role" : "Add Role"}
          subtitle="Role details"
          onClose={() => setEditing(null)}
          onSave={save}
          saving={saving}
          saveLabel="Save Role"
        >
          <Field label="Name" name="name" value={editing.name} required full />
          <Field
            label="Description"
            name="description"
            value={editing.description}
            full
          />
        </Drawer>
      )}
      {assigning && (
        <RolePermissions role={assigning} onClose={() => setAssigning(null)} />
      )}
    </div>
  );
}
