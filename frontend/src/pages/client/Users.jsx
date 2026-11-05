import { useEffect, useState } from "react";
import {
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { rolesApi, toFormData, usersApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import {
  Drawer,
  EmptyRow,
  Field,
  Select,
  Stat,
} from "../../components/MasterUI";
import { formValues, imageUrl } from "../../components/masterHelpers";
import Pagination from "../../components/Pagination";
import { usePaged } from "../../hooks";
import Breadcrumb from "../../components/Breadcrumb";
import "./Masters.css";

const PASSWORD_KEYS = ["password", "password_confirmation"];

const roleIdOf = (u) => String(u.role_id ?? u.role?.id ?? "");

export default function Users() {
  const [roles, setRoles] = useState([]);
  const [rolesReady, setRolesReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [editing, setEditing] = useState(null);

  // search / role filter / paging are all done by the backend
  const {
    rows: users,
    meta,
    summary,
    loading,
    reload: load,
    setPage,
    limit,
    setLimit,
    q,
    setQ,
  } = usePaged(
    (p) => usersApi.page({ ...p, ...(roleFilter ? { role: roleFilter } : {}) }),
    [roleFilter],
  );

  // roles are only needed for the filter, the Role column and the form
  useEffect(() => {
    rolesApi
      .list()
      .then(setRoles)
      .catch(() => {})
      .finally(() => setRolesReady(true));
  }, []);

  const roleNameOf = (u) =>
    u.role?.name ??
    u.role_name ??
    roles.find((r) => String(r.id) === roleIdOf(u))?.name ??
    "—";

  const save = async (e) => {
    e.preventDefault();
    const f = formValues(e.currentTarget);
    PASSWORD_KEYS.forEach((k) => {
      if (!f[k]) delete f[k];
    }); // blank = keep current password
    if (f.password !== undefined && f.password !== f.password_confirmation) {
      toast.error("Password and confirmation do not match");
      return;
    }
    setSaving(true);
    try {
      const body = toFormData(f);
      if (editing.id) await usersApi.update(editing.id, body);
      else await usersApi.create(body);
      toast.success(editing.id ? "User updated" : "User created");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save user"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name}?`)) return;
    try {
      await usersApi.remove(u.id);
      toast.success("User deleted");
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete user"));
    }
  };

  const isNew = !editing?.id;

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <Breadcrumb />
          <h1>Users</h1>
          <p>Create users, assign roles and manage their sign-in details.</p>
        </div>
        <button className="primary-btn" onClick={() => setEditing({})}>
          <Plus size={16} /> Add User
        </button>
      </header>

      <div className="master-stats">
        <Stat
          icon={UsersIcon}
          loading={!summary}
          value={summary?.total ?? 0}
          label="Total Users"
        />
        <Stat
          icon={ShieldCheck}
          loading={!rolesReady}
          value={roles.length}
          label="Roles"
        />
      </div>

      <section className="master-card">
        <div className="master-toolbar">
          <div className="master-search">
            <Search size={15} />
            <input
              placeholder="Search name, user ID or mobile..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Mobile</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <EmptyRow colSpan={4} loading={loading} rows={limit} />
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="name-cell">
                      <span className="row-icon" style={{ overflow: "hidden" }}>
                        {imageUrl(u.profile_image) ? (
                          <img
                            src={imageUrl(u.profile_image)}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          (u.name || "?").charAt(0).toUpperCase()
                        )}
                      </span>
                      <div>
                        <strong>{u.name}</strong>
                        <small>
                          @{u.userId || "—"}
                          {u.email ? ` · ${u.email}` : ""}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{u.mobile_number || "—"}</td>
                  <td>
                    <span className="source-badge">{roleNameOf(u)}</span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="icon-square"
                        title="Edit"
                        onClick={() => setEditing(u)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-square danger"
                        title="Delete"
                        onClick={() => remove(u)}
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
          label="users"
        />
      </section>

      {editing && (
        <Drawer
          title={isNew ? "Add User" : "Edit User"}
          subtitle="User ID, name and mobile are required; email is optional"
          onClose={() => setEditing(null)}
          onSave={save}
          saving={saving}
          saveLabel="Save User"
        >
          <Field
            label="User ID (used to sign in)"
            name="userId"
            value={editing.userId}
            required
            minLength={3}
            placeholder="e.g. murugan01"
          />
          <Field label="Name" name="name" value={editing.name} required />
          <Field
            label="Mobile Number"
            name="mobile_number"
            type="tel"
            value={editing.mobile_number}
            required
          />
          <Field
            label="Email (optional)"
            name="email"
            type="email"
            value={editing.email}
          />
          <Select
            label="Role"
            name="role_id"
            value={roleIdOf(editing)}
            placeholder="Select role"
            required
            options={roles.map((r) => ({ value: String(r.id), label: r.name }))}
          />
          <Field
            label={isNew ? "Password" : "New Password"}
            name="password"
            type="password"
            required={isNew}
            minLength={6}
            placeholder={isNew ? "" : "Leave blank to keep current"}
          />
          <Field
            label="Confirm Password"
            name="password_confirmation"
            type="password"
            required={isNew}
          />
          <Field
            label="Profile Image"
            name="profile_image"
            type="file"
            accept="image/*"
            full
          />
        </Drawer>
      )}
    </div>
  );
}
