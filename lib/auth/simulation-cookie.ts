// The simulation cookie's name, in a module of its own so the edge proxy can
// import it without pulling in node:crypto or next/headers.
//
// proxy.ts only ever checks whether the cookie is PRESENT (the coarse
// write-block); the signature-verified read lives in lib/auth/simulation.ts.
export const SIMULATION_COOKIE = "olos_sim";

// The body of the 403 every write gets while the cookie is set. One constant
// so the edge block (proxy.ts), the verified block (lib/auth/middleware.ts) and
// the client-side notice (simulation-write-guard.tsx) cannot drift apart. The
// notice recognises the block by matching this string exactly.
export const SIMULATION_BLOCKED_MESSAGE =
  "Read-only while simulating a member. Exit the simulation to make changes.";
