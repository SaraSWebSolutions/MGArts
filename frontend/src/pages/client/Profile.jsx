import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { authApi, toFormData } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { Drawer, Field } from "../../components/MasterUI";
import { formValues, imageUrl } from "../../components/masterHelpers";
import { Skeleton } from "../../components/Loaders";
import Breadcrumb from "../../components/Breadcrumb";
import "./Masters.css";

// API response wrapper irundhalum illa-naalum profile object-a edukkum
const normalize = (res) =>
  res?.data?.data ?? res?.data ?? res?.user ?? res ?? null;

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0); // save aana apram form remount -> password fields clear

  useEffect(() => {
    authApi
      .profile()
      .then((res) => setProfile(normalize(res)))
      .catch((err) => {
        toast.error(getErrorMessage(err, "Failed to load profile"));
        if (user) setProfile(user); // fallback
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const save = async (e) => {
    e.preventDefault();
    const f = formValues(e.currentTarget);
    delete f.userId; // sign-in ID is changed by an admin only
    ["password", "password_confirmation"].forEach((k) => {
      if (!f[k]) delete f[k];
    });
    if (f.password !== undefined && f.password !== f.password_confirmation) {
      toast.error("Password and confirmation do not match");
      return;
    }
    setSaving(true);
    try {
      await authApi.updateProfile(toFormData(f));
      await refreshUser();
      toast.success("Profile updated");
      setEditing(false);
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update profile"));
    } finally {
      setSaving(false);
    }
  };

  const avatar = profile && imageUrl(profile.profile_image);

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <Breadcrumb />
          <h1>My Profile</h1>
          <p>Update your name, contact number, photo and password.</p>
        </div>
        {profile && !editing && (
          <button className="primary-btn" onClick={() => setEditing(true)}>
            Edit Profile
          </button>
        )}
      </header>

      <section className="master-card" style={{ maxWidth: 720 }}>
        {!profile ? (
          <div style={{ padding: 26 }} aria-busy="true">
            <Skeleton width={72} height={72} style={{ borderRadius: "50%" }} />
            {[60, 78, 52, 70].map((w, i) => (
              <Skeleton key={i} width={`${w}%`} height={14} style={{ marginTop: 22 }} />
            ))}
          </div>
        ) : (
          <div className="drawer-body">
            <div className="field full">
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span
                  className="avatar"
                  style={{ width: 72, height: 72, fontSize: 28 }}
                >
                  {(profile.name || "A").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="field">
              <label>Name</label>
              <div>{profile.name || "-"}</div>
            </div>
            <div className="field">
              <label>User ID</label>
              <div>{profile.userId || "-"}</div>
            </div>
            <div className="field">
              <label>Mobile Number</label>
              <div>{profile.mobile_number || "-"}</div>
            </div>
            <div className="field">
              <label>Email</label>
              <div>{profile.email || "-"}</div>
            </div>
          </div>
        )}
      </section>

      {editing && profile && (
        <Drawer
          title="Edit Profile"
          subtitle="Name, contact details, photo and password"
          onClose={() => setEditing(false)}
          onSave={save}
          saving={saving}
          saveLabel="Save Changes"
        >
          <Field
            label="User ID"
            name="userId"
            value={profile.userId}
            readOnly
          />
          <Field label="Name" name="name" value={profile.name} required />
          <Field
            label="Mobile Number"
            name="mobile_number"
            type="tel"
            value={profile.mobile_number}
            required
          />
          <Field
            label="Email (optional)"
            name="email"
            type="email"
            value={profile.email}
          />
          <Field
            label="Profile Image"
            name="profile_image"
            type="file"
            accept="image/*"
            full
          />
          <Field
            label="New Password"
            name="password"
            type="password"
            minLength={6}
            placeholder="Leave blank to keep current"
          />
          <Field
            label="Confirm Password"
            name="password_confirmation"
            type="password"
          />
        </Drawer>
      )}
    </div>
  );
}
