import PulseCheckForm from "./pulse-check-form";
import { copy } from "./copy";

interface Option {
  id: number;
  value: string;
}

interface Props {
  enforcement: {
    last_completed_at: string | null;
    deadline: string;
    status: "ok" | "warning_3day" | "warning_1day" | "overdue";
    locked: boolean;
  };
  aiTools: Option[];
  pulseBenefits: Option[];
  cycle: { id: number; name: string } | null;
  pods: { id: number; name: string }[];
  projects: { id: number; name: string; pod_id: number }[];
}

export default function PulseCheckLocked(props: Props) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-midnight">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 rounded-md border border-red-500/40 bg-red-500/[0.08] p-5">
          <h1 className="text-xl font-bold text-red-300">{copy.locked.title}</h1>
          <p className="mt-2 text-sm text-cloud/80">{copy.locked.body}</p>
          <p className="mt-2 text-xs text-cloud/60">{copy.locked.note}</p>
        </div>
        <PulseCheckForm {...props} />
      </div>
    </div>
  );
}
