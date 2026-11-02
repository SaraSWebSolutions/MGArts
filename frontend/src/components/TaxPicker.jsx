/** pick one or more taxes (e.g. GST, SGST) that you added yourself in Masters > Tax Rates */
export default function TaxPicker({ label = "Taxes", taxes, value, onChange }) {
  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="field full">
      <label>{label}</label>
      {taxes.length === 0 ? (
        <div className="tax-empty">
          No taxes added yet. Add them in Masters → Tax Rates (for example GST,
          SGST).
        </div>
      ) : (
        <div className="tax-pick">
          {taxes.map((t) => (
            <label
              key={t.id}
              className={`tax-chip ${value.includes(t.id) ? "on" : ""}`}
            >
              <input
                type="checkbox"
                checked={value.includes(t.id)}
                onChange={() => toggle(t.id)}
              />
              <span>{t.name}</span>
              <b>{t.rate}%</b>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
