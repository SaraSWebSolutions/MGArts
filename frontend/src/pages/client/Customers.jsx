import { Users } from "lucide-react";
import MasterPage from "../../components/MasterPage";
import { customersApi } from "../../services/endpoints";

export default function Customers() {
  return (
    <MasterPage
      eyebrow="MASTERS / CUSTOMERS"
      title="Customers"
      subtitle="People who give gold bars / old gold for jewellery making. Their gold is tracked as Customer Stock."
      icon={Users}
      api={customersApi}
      perm="customers-manage"
      addLabel="Add Customer"
      search={(r) => `${r.name}${r.code}${r.mobile}${r.gstin}`}
      primary={(r) => ({ title: r.name, sub: r.code })}
      columns={[
        { label: "Customer" },
        { label: "Mobile", render: (r) => r.mobile || "—" },
        { label: "Address", render: (r) => r.address || "—" },
        { label: "GSTIN", render: (r) => r.gstin || "—" },
      ]}
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "mobile", label: "Mobile" },
        { name: "address", label: "Address", full: true },
        { name: "gstin", label: "GSTIN (optional)", full: true },
      ]}
    />
  );
}
