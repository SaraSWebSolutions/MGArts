import { Percent } from "lucide-react";
import MasterPage from "../../components/MasterPage";
import { taxRatesApi } from "../../services/endpoints";

export default function TaxRates() {
  return (
    <MasterPage
      eyebrow="MASTERS / TAX RATES"
      title="Tax Rates"
      subtitle="Add the taxes you charge, one by one (for example GST 3%, or CGST 1.5% and SGST 1.5%). On a bill you tick the taxes to apply; each is calculated separately and shown by the name you give here."
      icon={Percent}
      api={taxRatesApi}
      perm="settings-manage"
      addLabel="Add Tax Rate"
      search={(r) => `${r.name}${r.type}${r.rate}`}
      primary={(r) => ({ title: r.name, sub: r.isDefault ? "Default" : "" })}
      columns={[
        { label: "Name" },
        { label: "Rate", render: (r) => `${r.rate}%` },
        {
          label: "Used for",
          render: (r) => (
            <span className="source-badge">
              {
                {
                  making: "Making charges",
                  sale: "Jewellery sale",
                  other: "Other",
                }[r.type]
              }
            </span>
          ),
        },
        { label: "Default", render: (r) => (r.isDefault ? "Yes" : "—") },
      ]}
      fields={[
        { name: "name", label: "Name", required: true, full: true },
        {
          name: "rate",
          label: "Rate %",
          type: "number",
          step: "0.01",
          required: true,
        },
        {
          name: "type",
          label: "Used for",
          type: "select",
          options: [
            { value: "making", label: "Making charges" },
            { value: "sale", label: "Jewellery sale" },
            { value: "other", label: "Other" },
          ],
          def: "making",
        },
        {
          name: "isDefault",
          label: "Auto-select on new bills?",
          type: "select",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ],
          def: "false",
        },
      ]}
      note="Nothing is split automatically: whatever you add here is exactly what is printed. You can mark more than one tax as default. Confirm the rates with your CA. Changing a rate does not alter bills already created."
    />
  );
}
