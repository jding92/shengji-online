# Rules assumptions

The implementation plan fixes the core contract but leaves a few table customs
implicit. These decisions are explicit so a newly discovered house rule becomes
a fixture or ruleset option rather than a silent behavior change.

- Seat numbers advance counter-clockwise: `0 -> 1 -> 2 -> 3`.
- A round with no bid is redealt at the same level with a fresh seed.
- Later-round leaders progress to the next seat on the team that won the round.
  This yields the opposite partner after a defense and the adjacent attacker
  after attackers take over.
- Physical duplicate cards form tuples by printed face. Effective rank controls
  ordering and tractor adjacency; it does not make differently printed
  secondary level cards an identical pair.
- Removing the level rank closes the ordinary sequence, so `2244` is a tractor
  when 3 is level. Secondary level, primary level, small joker, and big joker
  form consecutive trump groups.
- A tuple of size two or greater uses the configured pair bottom multiplier.
  Throws use their longest parsed component, with tractor winning equal-length
  ambiguity.
- Failed-throw adjustments are included after trick/bottom points. A negative
  final attacker total is clamped to zero before threshold scoring.
- A matching throw play beats another only when its corresponding components
  are never lower and at least one is higher. Incomparable component mixes leave
  the earlier winning play in front.
- The v1 fixed teams are public. Future finding-friends rooms must redact team
  identity until its reveal event.

Recommended next configurability: make no-bid behavior and leader progression
named ruleset strategies before exposing custom-room controls.
