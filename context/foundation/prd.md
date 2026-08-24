---
project: "Eloquence Flashcards"
version: 1
status: draft
created: 2026-08-17
context_type: greenfield
product_type: mobile
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 1.5
  hard_deadline: 2026-08-27
  after_hours_only: true
---

## Vision & Problem Statement

Young adults freeze up when speaking with more educated or more articulate people and, rather than fumbling for an opening, they opt out of the conversation entirely — losing the chance to participate, be heard, or build the relationship.

Existing eloquence resources (books, courses, speechwriting guides) are long-form and aimed at prepared speech, not live conversation. The insight here is narrower and more practical: the specific, recurring failure point is how to start — and that is a skill that responds well to short, spaced, habitual practice (flashcards), not long-form study.

## User & Persona

General young adults navigating social settings with older or more articulate people — acquaintances, family members, mentors. The moment they reach for this product: before or during a conversation where they feel outmatched conversationally and don't know how to begin.

## Success Criteria

### Primary
- User can complete the loop end-to-end: input a description of the person/interests they're about to talk to → app shows a tailored vocabulary flashcard (word + definition) → user marks it known/unknown → app shows the next card. Loop works with no crashes/dead-ends.

### Secondary
- Cards adapt over time — the app gets better at picking relevant words as the user marks more known/unknown.

### Guardrails
- Fast, snappy card loading — no noticeable lag between input and seeing a card, since the moment before a conversation is time-pressured.

## User Stories

### US-01: User gets a tailored word before a conversation

- **Given** a user about to talk to someone
- **When** they input a short description of the person/their interests
- **Then** they see a flashcard with a vocabulary word and definition relevant to that description

#### Acceptance Criteria
- Card selection uses the input description, not a fully random pick
- User can mark the card known/unknown and immediately see the next card
- No login or setup required before this flow works

## Functional Requirements

- FR-001: User can input a description of the person/interests they're about to talk to. Priority: must-have
  > Socrates: Counter-argument considered: input adds friction right before a time-pressured conversation. Resolution: kept; no counter-argument accepted, stands as written.
- FR-002: User can view a flashcard (vocabulary word + definition) tailored to their input. Priority: must-have
  > Socrates: Counter-argument considered: a single word may not translate to spoken fluency / opening a sentence. Resolution: kept; no counter-argument accepted, stands as written.
- FR-003: User can mark a flashcard as known or unknown. Priority: must-have
  > Socrates: Counter-argument considered: known/unknown is coarse and doesn't capture conversational usability. Resolution: kept; no counter-argument accepted, stands as written.
- FR-004: User can add new flashcards manually. Priority: nice-to-have
  > Socrates: Counter-argument considered: not needed at all — a curated deck may be sufficient long-term, not just deferred. Resolution: kept as nice-to-have (not promoted, not dropped); revisit after MVP validates the curated deck.

## Non-Functional Requirements

- A user sees the tailored flashcard within a perceptibly instant response after submitting their description — no noticeable lag before a time-pressured conversation.
- The app remains fully usable with no network connection; the description-to-flashcard flow does not depend on connectivity.
- No description of a person entered by the user leaves the device.

## Business Logic

The app selects the vocabulary word most fitting for a conversation, based on the free-text description of the person and their interests/hobbies the user just typed in.

The rule consumes a short free-text description (person's role, interests, hobbies, context) as input. Its output is a single ranked word (with definition) judged most relevant/useful for that specific conversation, rather than a random or sequential pick from the deck. The user encounters this rule every time they open the app before a conversation: they type the description, and the word that comes back is the product's core value — a generic flashcard app would just cycle through cards in order or at random.

## Access Control

Single user; no auth; data lives on-device only. Flat single-user model — no roles, no multi-profile support in MVP.

## Non-Goals

- No custom-trained NLP/matching model — word selection uses a simple, off-the-shelf/rule-based matching approach rather than building or training a bespoke model. Rationale: avoids heavy ML scope inside a 1.5-week timeline.

## Open Questions

1. **Should cloud sync / multi-device support ever be in scope?** — Not addressed during shaping. Owner: user. Block: no.
2. **Should a spaced-repetition scheduling algorithm (review intervals, forgetting curves) be added beyond known/unknown marking?** — Not addressed during shaping. Owner: user. Block: no.
3. **What accessibility standard (if any) should the app target?** — Not addressed during shaping. Owner: user. Block: no.
