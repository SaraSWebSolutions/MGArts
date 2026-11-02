import { useMemo, useState } from "react";
import { Gem, Pencil, Scale, Search } from "lucide-react";
import toast from "react-hot-toast";
import { jewelleryApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { useList } from "../../hooks";
import {
  Badge,
  CField,
  Drawer,
  EmptyRow,
  Stat,
  Tabs,
} from "../../components/MasterUI";
import { clean, dt, karat, wt } from "../../components/masterHelpers";
import "./Masters.css";

const ST = {
  in_stock: ["green", "In stock"],
  sold: ["grey", "Sold"],
  delivered: ["purple", "Delivered"],
};

export default function Jewellery() {
  const { can } = useAuth();
  const [f, setF] = useState({
    owner: "own",
    status: "in_stock",
    purity: "",
    product: "",
    location: "",
  });
  const { rows, loading, reload } = useList(
    () => jewelleryApi.list(clean(f)),
    [f],
  );
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await jewelleryApi.update(edit.id, {
        name: edit.name,
        product: edit.product,
        location: edit.location,
      });
      toast.success("Updated");
      setEdit(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update"));
    } finally {
      setSaving(false);
    }
  };
  const shown = rows.filter((r) =>
    `${r.tag}${r.name}${r.product}${r.customer?.name || ""}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const products = [...new Set(rows.map((r) => r.product))];
  // keep every product / location seen so the dropdowns do not shrink after filtering
  const known = useMemo(
    () => ({
      products: [...new Set(rows.map((r) => r.product).filter(Boolean))].sort(),
      locations: [...new Set(rows.map((r) => r.location).filter(Boolean))].sort(),
    }),
    [rows],
  );
  // classification: owner > purity > product
  const groups = useMemo(() => {
    const m = {};
    shown.forEach((r) => {
      const k = `${r.owner}|${r.customer?.name || ""}|${r.purity}|${r.product}`;
      const g = (m[k] ||= {
        owner: r.owner,
        customer: r.customer?.name || "",
        purity: r.purity,
        product: r.product,
        pieces: 0,
        weight: 0,
      });
      g.pieces += 1;
      g.weight += r.weight;
    });
    return Object.values(m).sort(
      (a, b) =>
        a.owner.localeCompare(b.owner) ||
        b.purity - a.purity ||
        a.product.localeCompare(b.product),
    );
  }, [shown]);

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <span className="master-eyebrow">STOCK / JEWELLERY</span>
          <h1>Jewellery Stock</h1>
          <p>
            Finished pieces classified by product, purity and owner. Own
            jewellery is sold; customer jewellery is delivered.
          </p>
        </div>
      </header>
      <div className="master-stats">
        <Stat icon={Gem} value={shown.length} label="Pieces" />
        <Stat
          icon={Scale}
          value={wt(shown.reduce((s, r) => s + r.weight, 0))}
          label="Total Weight"
        />
        <Stat icon={Gem} value={products.length} label="Product Types" />
      </div>
      <Tabs
        value={f.owner}
        onChange={(v) => setF({ ...f, owner: v })}
        items={[
          { value: "own", label: "Own jewellery" },
          { value: "customer", label: "Customer jewellery" },
          { value: "", label: "Both" },
        ]}
      />
      <section className="master-card">
        <div className="master-toolbar">
          <div className="master-search">
            <Search size={15} />
            <input
              placeholder="Search tag, name, customer..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <select
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value })}
            >
              <option value="">All status</option>
              <option value="in_stock">In stock</option>
              <option value="sold">Sold</option>
              <option value="delivered">Delivered</option>
            </select>
            <select
              value={f.purity}
              onChange={(e) => setF({ ...f, purity: e.target.value })}
            >
              <option value="">All purity</option>
              <option value="916">22K · 916</option>
              <option value="875">21K · 875</option>
              <option value="750">18K · 750</option>
              <option value="999">24K · 999</option>
            </select>
            <select
              value={f.product}
              onChange={(e) => setF({ ...f, product: e.target.value })}
            >
              <option value="">All products</option>
              {known.products.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            <select
              value={f.location}
              onChange={(e) => setF({ ...f, location: e.target.value })}
            >
              <option value="">All locations</option>
              {known.locations.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>Tag / item</th>
                <th>Product</th>
                <th>Owner</th>
                <th className="num">Weight</th>
                <th>Purity</th>
                <th>Location</th>
                <th>Status</th>
                {can("jobs-manage") && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && <EmptyRow colSpan={8} loading={loading} />}
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="name-cell">
                      <span className="row-icon">
                        <Gem size={16} />
                      </span>
                      <div>
                        <strong>{r.tag}</strong>
                        <small>{r.name}</small>
                      </div>
                    </div>
                  </td>
                  <td>{r.product}</td>
                  <td>
                    <Badge tone={r.owner === "own" ? "amber" : "blue"}>
                      {r.owner === "own" ? "Own" : "Customer"}
                    </Badge>
                    <span className="sub">{r.customer?.name || ""}</span>
                  </td>
                  <td className="num">
                    {wt(r.weight)}
                    {r.stoneWeight > 0 && (
                      <span className="sub">
                        Gross {wt(r.grossWeight)} · stone {wt(r.stoneWeight)}
                      </span>
                    )}
                  </td>
                  <td>
                    {karat(r.purity)} · {r.purity}
                  </td>
                  <td>
                    {r.location}
                    <span className="sub">{dt(r.createdAt)}</span>
                  </td>
                  <td>
                    <Badge tone={ST[r.status][0]}>{ST[r.status][1]}</Badge>
                  </td>
                  {can("jobs-manage") && (
                    <td>
                      {r.status === "in_stock" && (
                        <button
                          className="icon-square"
                          onClick={() => setEdit(r)}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="master-footer">{shown.length} pieces</div>
      </section>
      {groups.length > 0 && (
        <section className="master-card">
          <div className="master-toolbar">
            <strong>Classification summary</strong>
          </div>
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>Ownership</th>
                  <th>Purity</th>
                  <th>Product</th>
                  <th className="num">Pieces</th>
                  <th className="num">Net weight</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={`${g.owner}${g.customer}${g.purity}${g.product}`}>
                    <td>
                      <Badge tone={g.owner === "own" ? "amber" : "blue"}>
                        {g.owner === "own" ? "Own" : "Customer"}
                      </Badge>
                      <span className="sub">{g.customer}</span>
                    </td>
                    <td>
                      {karat(g.purity)} · {g.purity}
                    </td>
                    <td>{g.product}</td>
                    <td className="num">{g.pieces}</td>
                    <td className="num">{wt(g.weight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {edit && (
        <Drawer
          title={`Edit ${edit.tag}`}
          subtitle="Name, product type and location"
          onClose={() => setEdit(null)}
          onSave={save}
          saving={saving}
        >
          <CField
            full
            label="Name"
            value={edit.name}
            onChange={(v) => setEdit({ ...edit, name: v })}
          />
          <CField
            label="Product type"
            value={edit.product}
            onChange={(v) => setEdit({ ...edit, product: v })}
          />
          <CField
            label="Location"
            value={edit.location}
            onChange={(v) => setEdit({ ...edit, location: v })}
          />
        </Drawer>
      )}
    </div>
  );
}
