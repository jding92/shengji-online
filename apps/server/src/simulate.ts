import { simulateRound } from "@shengji/engine";

const { state, events } = simulateRound(process.argv[2] ?? "local-simulation");

console.log(
  JSON.stringify(
    {
      phase: state.phase,
      revision: state.revision,
      eventCount: events.length,
      tricks: state.round?.completedTricks.length,
      attackerPoints: state.round?.outcome?.attackerPoints,
      outcome: state.round?.outcome,
      ranks: state.ranks,
    },
    null,
    2,
  ),
);
