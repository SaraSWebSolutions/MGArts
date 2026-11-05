import { useEffect, useRef, useState } from "react";
import { Receipt, Scale, Store } from "lucide-react";
import toast from "react-hot-toast";
import { settingsApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { CField } from "../../components/MasterUI";
import { BlockSkeleton } from "../../components/Loaders";
import Breadcrumb from "../../components/Breadcrumb";
import "./Masters.css";
import "./SettingsLogo.css";

const KEYS = [
  "shopName",
  "phone",
  "address",
  "gstin",
  "state",
  "sacCode",
  "basePurity",
  "barPurity",
  "wastageAlertPercent",
];
const NUMBERS = ["basePurity", "barPurity", "wastageAlertPercent"];
const pick = (o) => Object.fromEntries(KEYS.map((k) => [k, o?.[k] ?? ""]));

function Section({ icon: Icon, title, text, children }) {
  return (
    <section className="master-card settings-card">
      <div className="settings-card-head">
        <span className="settings-ico">
          <Icon size={19} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{text}</p>
        </div>
      </div>
      <div className="settings-fields">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { can } = useAuth();
  const canEdit = can("settings-manage");
  const [saved, setSaved] = useState(null);
  const [v, setV] = useState(null);
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState(null); // uploaded invoice header image (null = default MG Arts logo)
  const [logoBusy, setLogoBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    settingsApi
      .get()
      .then((r) => {
        setSaved(pick(r));
        setV(pick(r));
        setLogo(r.logo || null);
      })
      .catch((e) => toast.error(getErrorMessage(e, "Failed to load settings")));
  }, []);

  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val }));
  const dirty = !!v && KEYS.some((k) => String(v[k]) !== String(saved[k]));

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file");
    if (file.size > 3 * 1024 * 1024) return toast.error("Image must be 3 MB or smaller");
    setLogoBusy(true);
    try {
      const r = await settingsApi.uploadLogo(file);
      setLogo(r.data.data.logo || null);
      toast.success("Logo updated - it is used on every printed document");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to upload logo"));
    } finally {
      setLogoBusy(false);
    }
  };
  const dropLogo = async () => {
    setLogoBusy(true);
    try {
      await settingsApi.removeLogo();
      setLogo(null);
      toast.success("Default logo restored");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove logo"));
    } finally {
      setLogoBusy(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...v };
      NUMBERS.forEach((k) => {
        body[k] = Number(v[k]);
      });
      const r = await settingsApi.update(body).then((res) => res.data.data);
      setSaved(pick(r));
      setV(pick(r));
      setLogo(r.logo || null);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="master-page" onSubmit={save}>
      <header className="master-head">
        <div>
          <Breadcrumb />
          <h1>Shop Settings</h1>
          <p>
            Your shop details are printed on every receipt and invoice. The
            gold rules are used for conversion and job work.
          </p>
        </div>
      </header>

      {!v && (
        <div className="settings-grid">
          <div className="settings-main">
            {[0, 1, 2].map((i) => (
              <section className="master-card settings-card" key={i} style={{ padding: 22 }}>
                <BlockSkeleton lines={4} />
              </section>
            ))}
          </div>
        </div>
      )}
      {v && (
      <fieldset
        disabled={!canEdit}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <div className="settings-grid">
          <div className="settings-main">
            <Section
              icon={Store}
              title="Shop details"
              text="Name and contact shown at the top of printed documents"
            >
              <CField
                full
                label="Shop name"
                required
                value={v.shopName}
                onChange={set("shopName")}
              />
              <CField label="Phone" value={v.phone} onChange={set("phone")} />
              <CField
                label="State (place of supply)"
                value={v.state}
                onChange={set("state")}
              />
              <CField
                full
                label="Address"
                value={v.address}
                onChange={set("address")}
              />
            </Section>

            <Section
              icon={Receipt}
              title="Tax & invoice"
              text="Registration details printed on tax invoices"
            >
              <CField label="GSTIN" value={v.gstin} onChange={set("gstin")} />
              <CField
                label="SAC code (making charges)"
                value={v.sacCode}
                onChange={set("sacCode")}
              />
              <div className="settings-hint">
                Tax rates are added under <b>Masters → Tax Rates</b>.
              </div>
            </Section>

            <Section
              icon={Scale}
              title="Gold rules"
              text="Default purities and the wastage warning level"
            >
              <CField
                label="Base purity (22K = 916)"
                type="number"
                required
                value={v.basePurity}
                onChange={set("basePurity")}
              />
              <CField
                label="Bar purity (24K = 999)"
                type="number"
                required
                value={v.barPurity}
                onChange={set("barPurity")}
              />
              <CField
                label="Wastage alert % (reports)"
                type="number"
                step="0.1"
                value={v.wastageAlertPercent}
                onChange={set("wastageAlertPercent")}
              />
            </Section>
          </div>

          <aside className="settings-side">
            <div className="master-card settings-preview">
              <span className="settings-preview-tag">Invoice header preview</span>
              <div className="logo-box">
                <img src={logo || "/assets/logo-horizontal.jpg"} alt="Invoice logo" />
              </div>
              {canEdit && (
                <>
                  <div className="logo-actions">
                    <button
                      type="button"
                      disabled={logoBusy}
                      onClick={() => fileRef.current?.click()}
                    >
                      {logoBusy ? "Please wait..." : logo ? "Change logo" : "Upload logo"}
                    </button>
                    {logo && (
                      <button
                        type="button"
                        className="danger"
                        disabled={logoBusy}
                        onClick={dropLogo}
                      >
                        Remove
                      </button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={pickLogo}
                    />
                  </div>
                  <p className="logo-note">PNG / JPG, up to 3 MB. Saved immediately.</p>
                </>
              )}
              <h4>{v.shopName || "Your shop name"}</h4>
              <p>{v.address || "Shop address"}</p>
              <p>
                {[v.phone && `Ph: ${v.phone}`, v.state].filter(Boolean).join(" · ")}
              </p>
              <div className="settings-preview-line">
                <span>GSTIN</span>
                <b>{v.gstin || "—"}</b>
              </div>
              <div className="settings-preview-line">
                <span>SAC</span>
                <b>{v.sacCode || "—"}</b>
              </div>
            </div>
          </aside>
        </div>
      </fieldset>
      )}

      {canEdit && v && (
        <div className="settings-savebar">
          <span>{dirty ? "You have unsaved changes" : "All changes saved"}</span>
          <div>
            <button
              type="button"
              className="secondary-btn"
              disabled={!dirty || saving}
              onClick={() => setV(saved)}
            >
              Reset
            </button>
            <button className="primary-btn" disabled={!dirty || saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
