import type { CardInstance, PrivateGameView } from "@shengji/protocol";
import type { ComponentProps, ReactNode } from "react";
import { ART_ASSET_IDS, artAssetPath, artAssetSrcSet } from "../lib/art-registry";
import type { TeamRole } from "../lib/cards";
import { PlayingCard } from "./card";
import { LeaveButton } from "./leave-button";
import { ChromeArtPanel, ChromeButton, ChromePanel } from "./ui-chrome";

type TeamSummary = {
  label: string;
  rank: string | null;
  role: TeamRole;
  teamClass: string;
};

type PreviousResult = {
  winnerLabel: string;
  attackerPoints: number;
  winner: "defenders" | "attackers";
};

type ProjectedOutcome = {
  winner: "defenders" | "attackers";
  levelDelta: number;
};

type StandingTrump = NonNullable<PrivateGameView["publicRound"]>["trumpSpec"];

/** A labelled HUD well whose content remains independent from panel artwork. */
export function DashboardSection({
  label,
  className,
  children,
  ...props
}: {
  label: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof ChromePanel>, "children">) {
  return (
    <ChromePanel
      className={`dashboard-section${className === undefined ? "" : ` ${className}`}`}
      {...props}
    >
      <small className="dashboard-section-label">{label}</small>
      {children}
    </ChromePanel>
  );
}

function dashboardTeamLabel(label: string): string {
  const [, englishLabel] = label.split("·");
  return englishLabel?.trim() ?? label;
}

/**
 * The generated emblem is the visible role language. Its accessible name keeps
 * the same information available without repeating 攻/守 and ATTACK/DEFEND in
 * the narrow dashboard rail.
 */
export function TeamRoleBadge({
  role,
  compact = false,
}: {
  role: TeamRole;
  compact?: boolean;
}) {
  if (role === "pending") {
    return (
      <span
        className={`role-medallion role-medallion-pending${compact ? " is-compact" : ""}`}
        role="img"
        aria-label="Role pending"
      >
        ?
      </span>
    );
  }
  const badge = ART_ASSET_IDS.gameplayUi(
    role === "attacking" ? "attack-badge" : "defend-badge",
  );
  return (
    <img
      className={`role-medallion${compact ? " is-compact" : ""}`}
      data-art-asset={badge}
      src={artAssetPath(badge)}
      srcSet={artAssetSrcSet(badge)}
      alt={role === "attacking" ? "Attacking team" : "Defending team"}
      draggable={false}
    />
  );
}

export function GameDashboard({
  roomId,
  yourTeam,
  rivalTeam,
  roundNumber,
  trumpRank,
  standingTrump,
  trumpCard,
  attackerPoints,
  pointsTone,
  pointProgress,
  pointThresholds,
  pointMeterMax,
  projectedOutcome,
  previousResult,
  buriedPoints,
  bottomOpen,
  onToggleBottom,
  muted,
  onToggleMuted,
  onLeave,
}: {
  roomId: string;
  yourTeam: TeamSummary;
  rivalTeam: TeamSummary;
  roundNumber: number;
  trumpRank: string;
  standingTrump: StandingTrump | undefined;
  trumpCard: CardInstance | undefined;
  attackerPoints: number;
  pointsTone: string;
  pointProgress: number;
  pointThresholds: readonly number[];
  pointMeterMax: number;
  projectedOutcome: ProjectedOutcome | null;
  previousResult: PreviousResult | null;
  buriedPoints: number | null;
  bottomOpen: boolean;
  onToggleBottom: () => void;
  muted: boolean;
  onToggleMuted: () => void;
  onLeave: () => void;
}) {
  const clampedPointProgress = Math.max(0, Math.min(100, pointProgress));

  return (
    <aside
      className="side-panel"
      aria-label="Game dashboard"
      data-dashboard-layout="responsive-rail"
    >
      <div className="brand-lockup dashboard-identity">
        <span className="brand-mark">升</span>
        <span>
          <strong>Sheng Ji</strong>
          <small>Room {roomId}</small>
        </span>
      </div>

      <ChromeArtPanel
        asset={ART_ASSET_IDS.panelFrame}
        className="dashboard-panel"
        contentClassName="round-pills"
      >
        <div className="team-score-pills" aria-label="Team standings">
          {[yourTeam, rivalTeam].map((team) => (
            <ChromePanel
              key={team.label}
              className={`team-score-pill ${team.teamClass} is-${team.role}`}
              aria-label={`${dashboardTeamLabel(team.label)}, rank ${team.rank ?? "unknown"}, ${team.role}`}
            >
              <small className="team-score-name">
                {dashboardTeamLabel(team.label)}
              </small>
              <TeamRoleBadge role={team.role} />
              <span className="team-rank">
                <small>RANK</small>
                <strong>{team.rank ?? "—"}</strong>
              </span>
            </ChromePanel>
          ))}
          <span className="team-versus" aria-hidden="true">
            VS
          </span>
        </div>

        <div className="round-overview-row">
          <DashboardSection label="ROUND" className="game-stats-pill">
            <span className="current-round-stat">
              <strong>{roundNumber}</strong>
            </span>
            {previousResult === null ? (
              <span className="round-state-copy">OPENING DEAL</span>
            ) : (
              <span className="previous-round-stat">
                <i>PREVIOUS</i>
                <strong>{previousResult.winnerLabel}</strong>
                <b>
                  {previousResult.attackerPoints} pts · {previousResult.winner}
                </b>
              </span>
            )}
          </DashboardSection>

          <DashboardSection
            label="TRUMP"
            className="level-trump-pill"
            aria-label={
              standingTrump === undefined
                ? `Level ${trumpRank}, trump undeclared`
                : standingTrump.mode === "no-trump"
                  ? "No-trump"
                  : `${standingTrump.rank} of ${standingTrump.suit} is trump`
            }
          >
            {trumpCard !== undefined ? (
              <PlayingCard card={trumpCard} />
            ) : standingTrump?.mode === "no-trump" ? (
              <span className="generic-joker-card" aria-hidden="true">
                王
              </span>
            ) : (
              <span className="pending-trump-card" aria-hidden="true">
                <strong>{trumpRank}</strong>
                <b>?</b>
              </span>
            )}
          </DashboardSection>
        </div>

        <DashboardSection label="ROUND POINTS" className="points-pill">
          <div className="points-total">
            <TeamRoleBadge role="attacking" compact />
            <strong className={pointsTone}>{attackerPoints}</strong>
          </div>
          <span
            className="points-meter"
            role="progressbar"
            aria-label="Attacker scoring progress"
            aria-valuemin={0}
            aria-valuemax={pointMeterMax}
            aria-valuenow={Math.max(0, Math.min(pointMeterMax, attackerPoints))}
          >
            <span
              className="points-meter-fill"
              style={{ width: `${clampedPointProgress}%` }}
              aria-hidden="true"
            />
            {pointThresholds.map((threshold) => (
              <i
                key={threshold}
                style={{ left: `${(threshold / pointMeterMax) * 100}%` }}
                aria-hidden="true"
              />
            ))}
          </span>
          {projectedOutcome !== null && (
            <em
              className={`points-projection is-${projectedOutcome.winner}`}
              title="Outcome if the round ended at the current points"
            >
              <TeamRoleBadge
                role={
                  projectedOutcome.winner === "attackers" ? "attacking" : "defending"
                }
                compact
              />
              <b>
                {projectedOutcome.levelDelta > 0
                  ? `+${projectedOutcome.levelDelta} level`
                  : "Takes lead"}
              </b>
              <i>IF ENDED NOW</i>
            </em>
          )}
        </DashboardSection>

        {buriedPoints !== null && (
          <ChromeButton
            className={`bottom-tab${bottomOpen ? " is-open" : ""}`}
            aria-expanded={bottomOpen}
            onClick={onToggleBottom}
          >
            <img
              className="bottom-tab-icon"
              data-art-asset={ART_ASSET_IDS.gameplayUi("buried-cards")}
              src={artAssetPath(ART_ASSET_IDS.gameplayUi("buried-cards"))}
              srcSet={artAssetSrcSet(ART_ASSET_IDS.gameplayUi("buried-cards"))}
              alt=""
              aria-hidden="true"
            />
            <small>底牌 · BOTTOM</small>
            <strong>{buriedPoints} pts</strong>
          </ChromeButton>
        )}
      </ChromeArtPanel>

      <div className="side-actions">
        <ChromeButton
          className="sound-toggle"
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          aria-pressed={muted}
          onClick={onToggleMuted}
        >
          {muted ? "Sound off" : "Sound on"}
        </ChromeButton>
        <LeaveButton onLeave={onLeave} />
      </div>
    </aside>
  );
}
