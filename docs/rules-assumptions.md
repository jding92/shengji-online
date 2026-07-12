# Rules assumptions

Each preset fixes several table customs that vary across Sheng Ji groups.
These decisions are explicit so a newly discovered house rule becomes a
documented ruleset option (`GameOptions`, see `docs/game-modes-design.md`)
rather than a silent behavior change.

- Seat numbers advance counter-clockwise: `0 -> 1 -> 2 -> 3`.
- A round with no bid is redealt at the same level with a fresh seed
  (`noBidFallback` covers the strategy name). After two redeals, the first
  bottom card forces the trump suit; a joker forces no-trump. Seat 0 leads
  when this happens in round 1 of a fixed-teams table.
- Fixed teams: the winning bidder leads round 1. In later rounds, the
  progressed leader remains leader regardless of which seat wins the bid
  (`roundFlow.laterRoundLeader: "round-progression"`).
- Fixed teams: later-round leaders progress to the next seat on the team that
  won the round. This yields the opposite partner after a defense and the
  adjacent attacker after attackers take over.
- Finding friends: every round is open bidding at each player's own rank
  (`roundFlow.laterRoundLeader: "rebid-each-round"`,
  `bidding.declareRankSource: "bidder-own-rank"`) — there is no progressed
  leader to inherit. See the finding-friends rulings below for round-to-round
  handoff.
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
- Fixed-team tables are always public. Finding-friends tables redact team
  identity — seat views and bot observations only ever expose
  `knownTeamIdForSeat` — until a called copy is played and `FRIEND_REVEALED`
  fires.

## Finding-friends (找朋友) rulings

Genuinely contested house rules here are explicit `GameOptions`
(`friendCallCount`, `callableCards`), not hardcoded; the rest are v1 decisions
documented so a house-rule dispute becomes a fixture, not a silent change.

- The declarer may call a face they hold every copy of, effectively calling
  themselves; this is legal and simply plays out with fewer friends
  (`allowOwnCardCall`).
- A called copy that ends up buried in the bottom, or is otherwise never
  played, never reveals — that seat stays unknown for the whole round and
  scores as an attacker at round end. Playing the copy is the only way in.
- Copy-index reveal is cumulative event-order counting of a face across the
  round (bottom exclusive, since the bottom is never "played"); a single
  multi-card play can cross more than one call's threshold and reveal several
  friends at once.
- Rank advancement is per player, not per team: each seat on the winning side
  (by final membership, i.e. after all reveals) advances individually, with
  the same `mustDefendRanks` clamp fixed-team players get (see below).
- The game ends when the **declarer** successfully defends at
  `gameEndsOnSuccessfulDefenseAt`, mirroring the fixed-team "defending team
  holds at the game rank" rule but scoped to one seat.
- The previous round's declarer starts the next round (leads bidding); the
  actual next declarer is whoever wins that round's bid, which may be a
  different seat.
- `mustDefendRanks` clamp (shared with fixed teams): a player who was not on
  the defending side that round may not advance past a must-defend rank —
  landing exactly on one is always allowed, and defenders are exempt from the
  clamp entirely.
