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

Failed-throw adjustments are zero in the supported preset, but the ruleset
allows nonzero values. Negative final totals remain negative and use the `<1`
band.

The winning team advances by the scoring band's level delta and becomes the
defending team for the next round. Leadership moves forward to the next seat
belonging to that team. A defending team that holds while at A wins the game.
