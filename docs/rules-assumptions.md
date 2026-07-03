# Rules assumptions

The supported preset fixes several table customs that vary across Sheng Ji
groups. These decisions are explicit so a newly discovered house rule becomes a
fixture or ruleset option rather than a silent behavior change.

- Seat numbers advance counter-clockwise: `0 -> 1 -> 2 -> 3`.
- A round with no bid is redealt at the same level with a fresh seed. After two
  redeals, the first bottom card forces the trump suit; a joker forces
  no-trump. Seat 0 leads when this happens in round 1.
- The winning bidder leads round 1. In later rounds, the progressed leader
  remains leader regardless of which seat wins the bid.
- Later-round leaders progress to the next seat on the team that won the round.
  This yields the opposite partner after a defense and the adjacent attacker
  after attackers take over.
- Physical duplicate cards form tuples by printed face. Effective rank controls
  ordering and tractor adjacency; it does not make differently printed
  secondary level cards an identical pair.
- Removing the level rank closes the ordinary sequence, so `2244` is a tractor
  when 3 is level. Secondary level, primary level, small joker, and big joker
  form consecutive trump groups.
- The bottom multiplier is twice the card count of the largest canonical
  component in the final led format. This makes a single 2x, pair 4x, triple
  6x, two-pair tractor 8x, and three-pair tractor 12x. Throws use their largest
  component.
- Failed-throw adjustments are included after trick and bottom points. Negative
  final attacker totals are valid and fall into the first scoring band; they
  are not clamped.
- A matching throw play beats another only when its corresponding components
  are never lower and at least one is higher. Incomparable component mixes leave
  the earlier winning play in front.
- The v1 fixed teams are public. Future finding-friends rooms must redact team
  identity until its reveal event.

Before exposing custom-room controls, no-bid fallback and leader progression
still need named ruleset strategies rather than preset-specific command logic.
