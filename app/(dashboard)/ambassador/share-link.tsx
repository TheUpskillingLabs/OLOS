"use client";

import { useState } from "react";

/** Share the ambassador link (counts toward the pin): the share sheet, else
 *  copy to the clipboard. */
export default function ShareLink({ url, label, copied }: { url: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch {
      /* cancelled or blocked */
    }
  };
  return (
    <button type="button" className="btn btn-teal btn-sm" onClick={onClick}>
      {done ? copied : label}
    </button>
  );
}
