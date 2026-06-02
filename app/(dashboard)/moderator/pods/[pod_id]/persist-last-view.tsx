"use client";

import * as React from "react";
import { persistUiState } from "../../switcher";

/**
 * Side-effect-only Client Component. On mount, records this pod as the
 * caller's last_view so a return to /moderator redirects them back.
 *
 * Fires once per mount. The PUT is best-effort; failure is silent.
 */
export function PersistLastView({ podId }: { podId: number }) {
  React.useEffect(() => {
    persistUiState({ last_view: String(podId) });
  }, [podId]);
  return null;
}
