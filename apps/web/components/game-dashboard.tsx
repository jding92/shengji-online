import type {
  CardInstance,
  PrivateGameView,
  PublicFriendCall,
  SeatView,
} from "@shengji/protocol";
import type { ComponentProps, ReactNode } from "react";
import { ART_ASSET_IDS, artAssetPath, artAssetSrcSet } from "../lib/art-registry";
import type { TeamRole } from "../lib/cards";
import { callLabel } from "../lib/friend-calls";
import { PlayingCard } from "./card";
import { LeaveButton } from "./leave-button";
import { SeatAvatar } from "./seat-avatar";
import { ChromeArtPanel, ChromeButton, ChromePanel, ChromePortrait } from "./ui-chrome";

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
type FindingFriendsSummary = {
  declarerSeat: number | undefined;
  calls: NonNullable<NonNullable<PrivateGameView["publicRound"]>["friendCalls"]>;
  seats: SeatView[];
  roundsWonBySeat: Record<number, number>;
  outcome: NonNullable<PrivateGameView["publicRound"]>["outcome"];
};

function seatName(seat: SeatView | undefined, fallbackSeat?: number): string {
  return seat?.name ?? `Seat ${(fallbackSeat ?? seat?.seat ?? 0) + 1}`;
}

function FriendCallStrip({
  calls,
  seats,
}: {
  calls: readonly PublicFriendCall[];
  seats: readonly SeatView[];
}) {
  return (
    <DashboardSection label="FRIEND CALLS · 叫朋友" className="friend-call-strip">
      <div className="friend-call-chips" aria-label="Friend calls">
        {calls.map((call, index) => {
          const revealer =
            call.revealed === undefined
              ? undefined
              : seats.find((seat) => seat.seat === call.revealed?.seat);
          return (
            <span
              className={`friend-call-chip${call.revealed === undefined ? "" : " is-revealed"}`}
              data-call-index={index}
              key={`friend-call-${index}`}
            >
              <strong>{callLabel(call)}</strong>
              {call.revealed !== undefined && (
                <small>
                  {seatName(revealer, call.revealed.seat)} · TRICK{" "}
                  {call.revealed.trickNumber} · 第{call.revealed.trickNumber}墩
                </small>
              )}
            </span>
          );
        })}
      </div>
    </DashboardSection>
  );
}

function FindingFriendsSidePanel({ summary }: { summary: FindingFriendsSummary }) {
  const declarer = summary.seats.find((seat) => seat.seat === summary.declarerSeat);
  const roundEntries = Object.entries(summary.roundsWonBySeat).sort(
    ([left], [right]) => Number(left) - Number(right),
  );

  return (
    <div className="finding-friends-panel" data-finding-friends="true">
      <div className="friend-declarer">
        {declarer === undefined ? (
          <span className="friend-declarer-portrait friend-declarer-portrait-unknown">
            ?
          </span>
        ) : (
          <ChromePortrait className="friend-declarer-portrait">
            <SeatAvatar seat={declarer.seat} />
          </ChromePortrait>
        )}
        <span className="friend-declarer-copy">
          <small>DECLARER · 庄家</small>
          <strong>{seatName(declarer, summary.declarerSeat)}</strong>
        </span>
      </div>
      <div className="friend-slots" aria-label="Called friend seats">
        {summary.calls.map((call, index) => {
          const revealedSeat =
            call.revealed === undefined
              ? undefined
              : summary.seats.find((seat) => seat.seat === call.revealed?.seat);
          return (
            <span
              className={`friend-slot${call.revealed === undefined ? " is-hidden" : " is-revealed"}`}
              data-call-index={index}
              key={`friend-slot-${index}`}
            >
              <strong>
                {call.revealed === undefined
                  ? "?"
                  : seatName(revealedSeat, call.revealed.seat)}
              </strong>
              <small>{callLabel(call)}</small>
            </span>
          );
        })}
        {summary.calls.length === 0 && (
          <span className="friend-slot friend-slot-pending">
            CALLS PENDING · 等待叫牌
          </span>
        )}
      </div>
      <DashboardSection label="ROUNDS WON · 胜局" className="friend-rounds-won">
        <div className="friend-rounds-list">
          {roundEntries.map(([seat, wins]) => {
            const player = summary.seats.find(
              (candidate) => candidate.seat === Number(seat),
            );
            return (
              <span className="friend-round-row" key={seat}>
                <strong>{seatName(player, Number(seat))}</strong>
                <b>{wins}</b>
              </span>
            );
          })}
        </div>
      </DashboardSection>
    </div>
  );
}

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
  findingFriends,
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
  showTableSettings = false,
  onOpenTableSettings = () => undefined,
  onLeave,
}: {
  roomId: string;
  yourTeam: TeamSummary;
  rivalTeam: TeamSummary;
  findingFriends?: FindingFriendsSummary;
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
  showTableSettings?: boolean;
  onOpenTableSettings?: () => void;
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
        {findingFriends === undefined ? (
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
        ) : (
          <FindingFriendsSidePanel summary={findingFriends} />
        )}

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

        {findingFriends === undefined ? (
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
        ) : (
          <DashboardSection
            label={
              findingFriends.outcome === undefined &&
              findingFriends.calls.some((call) => call.revealed === undefined)
                ? "ROUND POINTS · PROVISIONAL · 暂计"
                : "ROUND POINTS"
            }
            className="points-pill"
          >
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
          </DashboardSection>
        )}

        {findingFriends !== undefined && findingFriends.calls.length > 0 && (
          <FriendCallStrip calls={findingFriends.calls} seats={findingFriends.seats} />
        )}

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
        {showTableSettings && (
          <ChromeButton variant="neutral" onClick={onOpenTableSettings}>
            Table settings · 桌面设置
          </ChromeButton>
        )}
        <LeaveButton onLeave={onLeave} />
      </div>
    </aside>
  );
}
