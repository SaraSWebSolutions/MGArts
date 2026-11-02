import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { settingsApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { Field } from "../../components/MasterUI";
import { formValues } from "../../components/masterHelpers";
import "./Masters.css";

export default function Settings() {
  const { can } = useAuth();
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    settingsApi
      .get()
      .then(setS)
      .catch((e) => toast.error(getErrorMessage(e, "Failed to load settings")));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      setS(
        await settingsApi
          .update(formValues(e.currentTarget))
          .then((r) => r.data.data),
      );
      toast.success("Settings saved");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <span className="master-eyebrow">SETTINGS</span>
          <h1>Shop Settings</h1>
          <p>
            Details printed on receipts and invoices, and the purity rules used
            for conversion.
          </p>
        </div>
      </header>
      <section className="master-card" style={{ maxWidth: 760 }}>
        {!s ? (
          <div className="master-empty" style={{ padding: 45 }}>
            Loading...
          </div>
        ) : (
          <form onSubmit={save}>
            <div className="drawer-body">
              <Field
                label="Shop name"
                name="shopName"
                value={s.shopName}
                required
              />
              <Field label="Phone" name="phone" value={s.phone} />
              <Field label="Address" name="address" value={s.address} full />
              <Field label="GSTIN" name="gstin" value={s.gstin} />
              <Field
                label="State (place of supply)"
                name="state"
                value={s.state}
              />
              <Field
                label="SAC code for making charges"
                name="sacCode"
                value={s.sacCode}
              />
              <Field
                label="Base purity (22K = 916)"
                name="basePurity"
                type="number"
                value={s.basePurity}
                required
              />
              <Field
                label="Bar purity (24K = 999)"
                name="barPurity"
                type="number"
                value={s.barPurity}
                required
              />
              <Field
                label="Wastage alert % (reports)"
                name="wastageAlertPercent"
                type="number"
                step="0.1"
                value={s.wastageAlertPercent}
              />
            </div>
            {can("settings-manage") && (
              <div className="drawer-actions">
                <button className="primary-btn" disabled={saving}>
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
