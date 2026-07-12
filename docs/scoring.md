# Scoring

Fives are worth 5 points; tens and kings are worth 10. Two decks contain 200
points. The attacker's final total is:

```text
attacker trick points
  + bottom points awarded
  + failed-throw adjustment
```

Bottom points are awarded only when the attacking team wins the final trick.
The multiplier is twice the card count of the largest component in the final
led format.

| Largest final component |                   Bottom multiplier |
| ----------------------- | ----------------------------------: |
| Single (1 card)         |                                  2x |
| Pair (2 cards)          |                                  4x |
| Triple (3 cards)        |                                  6x |
| Two-pair tractor        |                                  8x |
| Three-pair tractor      |                                 12x |
| Throw                   | 2x its largest component card count |

| Attacker points | Result                    |
| --------------: | ------------------------- |
|              <1 | Defenders +3              |
|            1–39 | Defenders +2              |
|           40–79 | Defenders +1              |
|          80–119 | Attackers defend next, +0 |
|         120–159 | Attackers defend next, +1 |
|         160–199 | Attackers defend next, +2 |
|            200+ | Attackers defend next, +3 |

Failed-throw adjustments are zero by default, but the ruleset allows nonzero
values. Negative final totals remain negative and use the `<1` band.

The table above is the 2-deck band (band = 40). Thresholds scale with deck
count: `band = 20 × decks`, so a 3-deck table uses band 60 and a 4-deck table
uses band 80; the same seven-tier shape (`<1`, `[1, band)`, `[band, 2·band)`,
… `[5·band, ∞)`) reproduces every production preset's thresholds and can be
regenerated for a custom band via the `scoring.bandSize` option.

The winning team advances by the scoring band's level delta and becomes the
defending team for the next round. Leadership moves forward to the next seat
belonging to that team. A defending team that holds while at A wins the game.

## Finding friends (找朋友)

Finding-friends scoring keeps the same point values, bottom multiplier, and
threshold table, but resolves membership per seat instead of per team:

- Each seat accumulates its own captured trick points (`pointsBySeat`) as the
  round is played; this is the accounting source of truth, and the running
  `attackerPoints` is only a provisional display value derived from it.
- A seat not publicly known to be a defender (`knownTeamIdForSeat`) counts
  toward the attacker total until it is revealed — an unrevealed friend, or a
  called copy that never gets played, scores as an attacker at round end.
  Final membership (`finalTeamIdForSeat`) is resolved only when the round
  ends, after every possible reveal.
- The attacker final total is the sum of `pointsBySeat` over seats whose final
  membership is `"attackers"`, plus the bottom award (if attackers won the
  final trick, by final membership) and the throw adjustment — same formula
  as fixed teams, summed over individual seats instead of a team.
- Rank advancement is per player, not per team: every seat on the winning side
  by final membership advances individually by the scoring band's level
  delta, each subject to its own `mustDefendRanks` clamp.
- The game ends when the **declarer** — not a fixed defending team — is on
  the winning (defending) side at `gameEndsOnSuccessfulDefenseAt`.
