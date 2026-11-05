import { useState } from "react";
import { Gem, Pencil, Scale, Search } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { jewelleryApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { usePaged } from "../../hooks";
import {
  Badge,
  CField,
  Drawer,
  EmptyRow,
  Stat,
  Tabs,
} from "../../components/MasterUI";
import { clean, dt, karat, wt } from "../../components/masterHelpers";
import Pagination from "../../components/Pagination";
import Breadcrumb from "../../components/Breadcrumb";
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
  const {
    rows,
    meta,
    summary,
    loading,
    reload,
    setPage,
    limit,
    setLimit,
    q,
    setQ,
  } = usePaged((p) => jewelleryApi.page({ ...clean(f), ...p }), [f]);
  const [edit, setEdit] = useState(null);
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
  // totals, dropdown values and the classification summary are calculated by the
  // backend for the whole filtered stock (not just the page on screen)
  const known = {
    products: summary?.products ?? [],
    locations: summary?.locations ?? [],
  };
  const groups = summary?.groups ?? [];

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <Breadcrumb />
          <h1>Jewellery Stock</h1>
          <p>
            Finished pieces classified by product, purity and owner. Own
            jewellery is sold; customer jewellery is delivered.
          </p>
        </div>
      </header>
      <div className="info-banner">
        {f.owner !== "own" ? (
          <>
            <strong>What is customer jewellery?</strong> Finished pieces made
            from a customer&apos;s own gold. They are not yours until
            delivered. To add: go to <Link to="/jobs">Job Work</Link>, issue the
            customer&apos;s gold to a worker, then click <b>Receive jewellery</b>{" "}
            when the pieces come back. Deliver them to the customer from the same
            page.
          </>
        ) : (
          <>
            <strong>What is own jewellery?</strong> Pieces that belong to your
            shop. To add: use{" "}
            <Link to="/purchases">Add Own Stock → Ready jewellery</Link>, or
            receive an Own job in <Link to="/jobs">Job Work</Link>. Sell them
            from <Link to="/sales">Own Sales</Link>.
          </>
        )}
      </div>
      <div className="master-stats">
        <Stat
          icon={Gem}
          loading={!summary}
          value={summary?.pieces ?? 0}
          label="Pieces"
        />
        <Stat
          icon={Scale}
          loading={!summary}
          value={wt(summary?.weight)}
          label="Total Weight"
        />
        <Stat
          icon={Gem}
          loading={!summary}
          value={summary?.productTypes ?? 0}
          label="Product Types"
        />
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
              {rows.length === 0 && (
                <EmptyRow colSpan={8} loading={loading} rows={limit} />
              )}
              {rows.map((r) => (
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
        <Pagination
          meta={meta}
          loading={loading}
          limit={limit}
          onPage={setPage}
          onLimit={setLimit}
          label="pieces"
        />
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
