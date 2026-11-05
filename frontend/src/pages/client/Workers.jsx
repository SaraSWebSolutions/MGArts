import { UserRound } from "lucide-react";
import MasterPage from "../../components/MasterPage";
import { workersApi } from "../../services/endpoints";

const KIND = {
  worker: "Worker",
  vendor: "Vendor",
  tool_vendor: "Tools vendor",
};

export default function Workers() {
  return (
    <MasterPage
      eyebrow="MASTERS / WORKERS"
      title="Workers & Vendors"
      subtitle="Goldsmiths for job work, suppliers of gold / jewellery, and vendors you buy tools & equipment from."
      icon={UserRound}
      api={workersApi}
      perm="workers-manage"
      addLabel="Add Worker / Vendor"
      search={(r) => `${r.name}${r.code}${r.mobile}${KIND[r.kind] || r.kind}`}
      primary={(r) => ({ title: r.name, sub: r.code })}
      columns={[
        { label: "Name" },
        {
          label: "Type",
          render: (r) => (
            <span className="source-badge">{KIND[r.kind] || "Worker"}</span>
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
            { value: "worker", label: "Worker (goldsmith - job work)" },
            { value: "vendor", label: "Vendor (gold / jewellery supplier)" },
            { value: "tool_vendor", label: "Tools & equipment vendor" },
          ],
          def: "worker",
        },
        { name: "mobile", label: "Mobile" },
        { name: "address", label: "Address", full: true },
      ]}
    />
  );
}
