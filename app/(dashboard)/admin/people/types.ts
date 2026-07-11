/** A participant as shown in the People list — identity + cross-cycle context.
    Shared by the page loader, the table, and the drill-in drawer. */
export type Person = {
  id: number;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string;
  created_at: string;
  is_test: boolean;
  is_staff: boolean;
  roles: string[];
  cycles: { cycle_id: number; cycle_name: string; status: string; mode: string | null }[];
  moderator_pods: { pod_id: number; pod_name: string; mode: string | null }[];
};
