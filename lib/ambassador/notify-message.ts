/* The words of the coordinator Slack posts. Pure module (no Next, no Slack).

   Data minimisation: a post says THAT something is waiting, in which Lab, and
   links to the page. It never carries an applicant's name, email, quiz result or
   a reviewer's decision: Slack keeps history, may have guests, and the page
   already enforces who may see the person. No "seen by" or per-reviewer status. */

export type CoordinatorEvent =
  | "application_waiting" // a new application needs two reviewers
  | "invite_waiting" // an invite needs a second coordinator's approval
  | "review_split" // two reviews disagree; an admin breaks the tie
  | "ready_for_button"; // an ambassador finished the guide

const WHAT: Record<CoordinatorEvent, string> = {
  application_waiting: "A new ambassador application is waiting for review",
  invite_waiting: "An ambassador invite is waiting for a second coordinator to approve it",
  review_split: "Two reviews of an ambassador application disagree, so an admin needs to decide",
  ready_for_button: "An ambassador finished the guide and is ready for their button",
};

const LINK_LABEL: Record<CoordinatorEvent, string> = {
  application_waiting: "Open the queue",
  invite_waiting: "Review the invite",
  review_split: "Open the queue",
  ready_for_button: "Open the queue",
};

export function coordinatorMessage(event: CoordinatorEvent, opts: { labName: string | null; baseUrl: string }): string {
  const where = opts.labName ?? "HQ";
  const url = `${opts.baseUrl.replace(/\/+$/, "")}/ambassador/coordinator`;
  return `${WHAT[event]} (${where}). <${url}|${LINK_LABEL[event]}>`;
}
