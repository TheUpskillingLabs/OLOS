import { describe, it, expect } from "vitest";
import { tallyLikes, groupComments, shapeComment } from "./social";

describe("tallyLikes", () => {
  it("counts likes per update and flags the viewer's own", () => {
    const { likeCount, likedByViewer } = tallyLikes(
      [
        { update_id: 1, participant_id: 10 },
        { update_id: 1, participant_id: 20 },
        { update_id: 2, participant_id: 10 },
      ],
      10
    );
    expect(likeCount.get(1)).toBe(2);
    expect(likeCount.get(2)).toBe(1);
    expect(likedByViewer.has(1)).toBe(true);
    expect(likedByViewer.has(2)).toBe(true);
  });

  it("marks nothing liked when the viewer is anonymous", () => {
    const { likedByViewer } = tallyLikes(
      [{ update_id: 1, participant_id: 10 }],
      null
    );
    expect(likedByViewer.size).toBe(0);
  });

  it("returns empty maps for no rows", () => {
    const { likeCount, likedByViewer } = tallyLikes([], 1);
    expect(likeCount.size).toBe(0);
    expect(likedByViewer.size).toBe(0);
  });
});

describe("shapeComment", () => {
  const base = {
    id: 5,
    update_id: 3,
    participant_id: 42,
    body: "nice work",
    created_at: "2026-07-09T00:00:00Z",
  };

  it("prefers preferred_name and builds initials", () => {
    const view = shapeComment({
      ...base,
      participants: {
        handle: "amy",
        preferred_name: "Ames",
        first_name: "Amy",
        last_name: "Ng",
        profile_image_url: null,
      },
    });
    expect(view.name).toBe("Ames");
    expect(view.initials).toBe("AN");
    expect(view.handle).toBe("amy");
    expect(view.updateId).toBe(3);
    expect(view.participantId).toBe(42);
  });

  it("normalizes an array embed and falls back to a full name", () => {
    const view = shapeComment({
      ...base,
      participants: [
        {
          handle: null,
          preferred_name: null,
          first_name: "Sam",
          last_name: "Lee",
          profile_image_url: "http://img",
        },
      ],
    });
    expect(view.name).toBe("Sam Lee");
    expect(view.avatarUrl).toBe("http://img");
    expect(view.handle).toBeNull();
  });

  it("falls back to a generic name and dot initials with no poster", () => {
    const view = shapeComment({ ...base, participants: null });
    expect(view.name).toBe("A member");
    expect(view.initials).toBe("•");
  });
});

describe("groupComments", () => {
  it("buckets shaped comments by update id, preserving order", () => {
    const mk = (id: number, update_id: number, body: string) => ({
      id,
      update_id,
      participant_id: 1,
      body,
      created_at: "2026-07-09T00:00:00Z",
      participants: {
        handle: null,
        preferred_name: "P",
        first_name: "P",
        last_name: "Q",
        profile_image_url: null,
      },
    });
    const grouped = groupComments([
      mk(1, 7, "first"),
      mk(2, 8, "other"),
      mk(3, 7, "second"),
    ]);
    expect(grouped.get(7)?.map((c) => c.body)).toEqual(["first", "second"]);
    expect(grouped.get(8)?.map((c) => c.body)).toEqual(["other"]);
  });
});
