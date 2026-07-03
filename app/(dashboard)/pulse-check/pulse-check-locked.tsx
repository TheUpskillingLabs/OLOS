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
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-paper">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div
          role="alert"
          className="gate-banner mb-6 shadow-card"
        >
          <h1 className="text-xl font-bold tracking-tight text-red">
            {copy.locked.title}
          </h1>
          <p className="mt-2 text-sm text-charcoal">{copy.locked.body}</p>
          <p className="mt-2 text-xs text-meta">{copy.locked.note}</p>
        </div>
        <PulseCheckForm {...props} />
      </div>
    </div>
  );
}
