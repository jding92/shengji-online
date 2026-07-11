import type { PrivateGameView } from "@shengji/protocol";
import { motion } from "motion/react";
import { ART_ASSET_IDS, artAssetPath, artAssetSrcSet } from "../lib/art-registry";
import { teamLabelForSeat } from "../lib/strings";
import { Countdown } from "./countdown";
import { SeatAvatar } from "./seat-avatar";
import { ChromePortrait } from "./ui-chrome";

export function PlayerTag({
  seat,
  isYou,
  isLeader,
  role,
  handTotal,
  timer,
}: {
  seat: PrivateGameView["seats"][number];
  isYou: boolean;
  isLeader: boolean;
  role: "attacking" | "defending" | null;
  handTotal?: number;
  timer?: { deadline: string; now: () => number };
}) {
  const playerName = isYou ? "You" : (seat.name ?? `Seat ${seat.seat + 1}`);
  const countLabel =
    isYou && handTotal !== undefined && handTotal > 0
      ? `${seat.cardCount} of ${handTotal} cards remaining`
      : `${seat.cardCount} cards remaining`;
  const ornamentAsset = ART_ASSET_IDS.playerNameplate;

  return (
    <div className="player-tag" data-player-tag-shell="transparent">
      <span
        className="player-tag-surface"
        data-player-tag-layer="surface"
        aria-hidden="true"
      />
      <img
        className="player-tag-ornament"
        data-player-tag-layer="ornament"
        data-art-asset={ornamentAsset}
        src={artAssetPath(ornamentAsset)}
        srcSet={artAssetSrcSet(ornamentAsset)}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <ChromePortrait className="player-tag-portrait" data-player-tag-layer="portrait">
        <SeatAvatar seat={seat.seat} />
      </ChromePortrait>

      <span className="player-tag-content" data-player-tag-layer="content">
        <span className="player-tag-name-row">
          <strong className="player-tag-name">{playerName}</strong>
          {isLeader && (
            <span className="leader-badge" title="Round leader · 庄家">
              庄
            </span>
          )}
        </span>
        <span className="player-tag-meta">
          <span>
            {seat.rank === null
              ? "Waiting"
              : `Lv ${seat.rank} · ${teamLabelForSeat(seat.seat)}`}
          </span>
          {role !== null && (
            <span
              className={`role-tag role-${role}`}
              title={role === "attacking" ? "Attacking · 攻方" : "Defending · 守方"}
            >
              {role === "attacking" ? "攻" : "守"}
            </span>
          )}
          {seat.isBot && (
            <span
              className="bot-badge"
              title={`Bot · ${seat.botDifficulty ?? "intermediate"}`}
            >
              BOT
            </span>
          )}
        </span>
      </span>

      {(seat.cardCount > 0 || timer !== undefined) && (
        <span className="player-status" data-player-tag-layer="status">
          {seat.cardCount > 0 && (
            <motion.span
              className="seat-count"
              key={seat.cardCount}
              aria-label={countLabel}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              {isYou && handTotal !== undefined && handTotal > 0
                ? `${seat.cardCount}/${handTotal}`
                : seat.cardCount}
            </motion.span>
          )}
          {timer !== undefined && (
            <span
              className="seat-timer-badge"
              data-player-tag-layer="timer"
              aria-label="Turn timer"
            >
              <Countdown deadline={timer.deadline} now={timer.now} />
            </span>
          )}
        </span>
      )}

      {!seat.connected && seat.playerId !== null && !seat.isBot && (
        <i className="offline-dot" title="Disconnected" />
      )}
    </div>
  );
}
