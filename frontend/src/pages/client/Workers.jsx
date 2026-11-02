import { UserRound } from "lucide-react";
import MasterPage from "../../components/MasterPage";
import { workersApi } from "../../services/endpoints";

export default function Workers() {
  return (
    <MasterPage
      eyebrow="MASTERS / WORKERS"
      title="Workers & Vendors"
      subtitle="Goldsmiths and vendors who receive gold and return finished jewellery."
      icon={UserRound}
      api={workersApi}
      perm="workers-manage"
      addLabel="Add Worker / Vendor"
      search={(r) => `${r.name}${r.code}${r.mobile}${r.kind}`}
      primary={(r) => ({ title: r.name, sub: r.code })}
      columns={[
        { label: "Name" },
        {
          label: "Type",
          render: (r) => (
            <span className="source-badge">
              {r.kind === "vendor" ? "Vendor" : "Worker"}
            </span>
          ),
        },
        { label: "Mobile", render: (r) => r.mobile || "—" },
        { label: "Address", render: (r) => r.address || "—" },
      ]}
      fields={[
        { name: "name", label: "Name", required: true },
        {
          name: "kind",
          label: "Type",
          type: "select",
          options: [
            { value: "worker", label: "Worker" },
            { value: "vendor", label: "Vendor" },
          ],
          def: "worker",
        },
        { name: "mobile", label: "Mobile" },
        { name: "address", label: "Address", full: true },
      ]}
    />
  );
}
