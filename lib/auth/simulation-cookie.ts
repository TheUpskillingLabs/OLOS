// The simulation cookie's name, in a module of its own so the edge proxy can
// import it without pulling in node:crypto or next/headers.
//
// proxy.ts only ever checks whether the cookie is PRESENT (the coarse
// write-block); the signature-verified read lives in lib/auth/simulation.ts.
export const SIMULATION_COOKIE = "olos_sim";
