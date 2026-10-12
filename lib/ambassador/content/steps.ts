/* The five guide steps, ported from the ambassadors repo (content/steps/*.md).
   Each body is Markdown, rendered by lib/ambassador/markdown.ts. A built-in
   block goes on its own line: <!-- ladder -->, <!-- faq -->, <!-- story -->,
   <!-- asks -->, <!-- present -->. Content license: CC BY 4.0
   (lib/ambassador/content/LICENSE.md). */

export interface GuideStep {
  id: string;
  order: number;
  title: string;
  readTime: number;
  summary: string;
  placeholder: boolean;
  body: string;
}

export const STEPS: GuideStep[] = [
  {
    id: "labs",
    order: 1,
    title: "The Labs",
    readTime: 3,
    summary: "The Upskilling Labs is a free community where people learn by building real projects together. Your job: help the right people find it.",
    placeholder: true,
    body: `## What we are

It grew out of a fall 2025 pilot run by DC Public Library and Levy, a strategic design firm. The pilot's alums founded The Labs in January 2026. It's nonpartisan, and it isn't a school or a bootcamp. Most people start at a workshop:

<!-- ladder -->

## Why it needs you

### You found your way through.

You did the getting. The Labs made room. Now you know the way.

### Be the one who says “come with me.”

No pitch. Just someone they trust, saying it.

### Be how it reaches the next neighborhood.

The Labs isn't a place. A region picks it up. Only if someone says so.

### Be early to something built to last. Bring someone.

A year old, volunteer-run, and hoping to outlast us all. Every person you bring is one more pair of hands.

## Your job

1. **Ask** someone what they're working toward.
2. **Share** 30 seconds of your own story.
3. **Invite** them to one dated next step.

You don't sell, and you don't collect contact details. People Join The Labs themselves at theupskillinglabs.org.

## Questions you'll get

<!-- faq -->

## Words to use

| Say | Not |
| --- | --- |
| The Labs | TUL |
| Upskiller, participant | student |
| Build Cycle, workshop | course, class, lesson |
| real problems in your community | civic problems |
| Join The Labs | sign up, get started |

**Legal status:** "a fiscally sponsored project of Superbloom Design, a 501(c)(3). Our own status is pending." Say exactly that.`,
  },
  {
    id: "conversation",
    order: 2,
    title: "The Conversation",
    readTime: 4,
    summary: "Three moves: ask about them, share 30 seconds of your story, and invite them to one dated next step.",
    placeholder: true,
    body: `## 1. Ask

Start with them, not us. Listen for a goal, a gap, or a change.

> "What got you to come out to this tonight?"

Two or three questions is plenty. Wait for the answers.

## 2. Share

Bridge from what they said, then tell your 30-second why: where you were, what happened, what changed.

> "I was in the same spot last spring. I joined a Build Cycle, and three months later I'd built something with a team I still talk to."

<!-- story -->

## 3. Invite

One specific next step, with a date. Match it to the person:

- **Came to a workshop:** the next Build Cycle.
- **New to tech events:** a workshop first.
- **Has expertise:** guide a small team as a mentor.
- **Has a real problem:** bring it to a Build Cycle.

> "The next workshop is Thursday the 14th at the library. It's free and hands-on. Want the link?"

Send people to theupskillinglabs.org. Thank them, whatever they say.

<!-- asks -->`,
  },
  {
    id: "your-story",
    order: 3,
    title: "Your Story",
    readTime: 10,
    summary: "Four short questions become the 30-second why you'll tell in every conversation and talk.",
    placeholder: true,
    body: ``,
  },
  {
    id: "room",
    order: 4,
    title: "The Room",
    readTime: 3,
    summary: "A five-minute talk in six beats. Start with the room, end with one dated ask, and leave the QR up.",
    placeholder: true,
    body: `## The talk

1. **Question** (15 sec). "Who here has changed jobs, or thought about it, in the last two years?"
2. **Story** (30 sec). Your 30-second why.
3. **What The Labs is** (30 sec). One sentence, then the ladder.
4. **Proof** (15 sec). One stat: "More than 300 people have come through our programs since January."
5. **Ask** (30 sec). The next date, the place, and what to bring.
6. **Join.** The QR stays up for questions.

Short on time? Keep three beats: the question, the ask, the QR.

## Questions

Repeat each question so the room hears it, then answer in a sentence or two. If you don't know, say so and point to the site.

## No screen?

Give the talk, then hold up the QR on your phone.

<!-- present -->`,
  },
  {
    id: "practice",
    order: 5,
    title: "Practice",
    readTime: 5,
    summary: "Six situations you'll meet. Decide what you'd say, then flip the card.",
    placeholder: true,
    body: ``,
  },
];
