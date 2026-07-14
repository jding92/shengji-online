import type { PrivateGameView } from "@shengji/protocol";
import { ART_ASSET_IDS, artAssetPath, artAssetSrcSet } from "../lib/art-registry";
import { portraitForSeat } from "../lib/seat-portraits";
import { Countdown } from "./countdown";
import { SeatAvatar } from "./seat-avatar";
import { ChromePortrait } from "./ui-chrome";

export function PlayerTag({
  seat,
  isYou,
  isLeader,
  role,
  isFriend = false,
  timer,
}: {
  seat: PrivateGameView["seats"][number];
  isYou: boolean;
  isLeader: boolean;
  role: "attacking" | "defending" | null;
  isFriend?: boolean;
  timer?: { deadline: string; now: () => number };
}) {
  const playerName = isYou ? "You" : (seat.name ?? `Seat ${seat.seat + 1}`);
  const ornamentAsset = ART_ASSET_IDS.playerNameplate;
  const leaderAsset = ART_ASSET_IDS.playerBadgeIcon("round-leader");
  const roleAsset =
    role === null
      ? null
      : ART_ASSET_IDS.playerBadgeIcon(
          role === "attacking" ? "role-attack" : "role-defend",
        );
  const playerType = seat.isBot ? "bot" : "human";
  const playerTypeAsset = ART_ASSET_IDS.playerBadgeIcon(`type-${playerType}`);
  const portrait = portraitForSeat(seat.seat);

  return (
    <div
      className={`player-tag ${timer === undefined ? "" : "has-timer"}`}
      data-player-tag-shell="transparent"
    >
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
      <ChromePortrait
        className="player-tag-portrait"
        data-player-tag-layer="portrait"
        {...(portrait.seatAccent === null
          ? {}
          : { "data-seat-accent": portrait.seatAccent })}
      >
        <SeatAvatar seat={seat.seat} />
      </ChromePortrait>

      <span className="player-tag-content" data-player-tag-layer="content">
        <span className="player-tag-name-row">
          <strong className="player-tag-name">{playerName}</strong>
        </span>
        <span className="player-tag-meta">
          {isLeader && (
            <img
              className="player-badge-icon leader-badge"
              data-art-asset={leaderAsset}
              data-round-leader="true"
              src={artAssetPath(leaderAsset)}
              srcSet={artAssetSrcSet(leaderAsset)}
              alt="Round leader"
              title="Round leader · 庄家"
              draggable={false}
            />
          )}
          {isFriend && (
            <span
              className="player-friend-badge"
              data-friend-badge="true"
              role="img"
              aria-label="Revealed friend · 朋友"
              title="Revealed friend · 朋友"
            >
              友
            </span>
          )}
          {roleAsset !== null && (
            <img
              className={`player-badge-icon player-role-asset role-${role}`}
              data-art-asset={roleAsset}
              data-player-role={role}
              src={artAssetPath(roleAsset)}
              srcSet={artAssetSrcSet(roleAsset)}
              alt={role === "attacking" ? "Attacking" : "Defending"}
              title={role === "attacking" ? "Attacking team" : "Defending team"}
              draggable={false}
            />
          )}
          <img
            className={`player-badge-icon player-type-asset type-${playerType}`}
            data-art-asset={playerTypeAsset}
            data-player-type={playerType}
            src={artAssetPath(playerTypeAsset)}
            srcSet={artAssetSrcSet(playerTypeAsset)}
            alt={seat.isBot ? "Bot player" : "Human player"}
            title={
              seat.isBot
                ? `Bot · ${seat.botDifficulty ?? "intermediate"}`
                : "Human player"
            }
            draggable={false}
          />
        </span>
      </span>

      {timer !== undefined && (
        <span className="player-status" data-player-tag-layer="status">
          <span
            className="seat-timer-badge"
            data-player-tag-layer="timer"
            aria-label="Turn timer"
          >
            <Countdown deadline={timer.deadline} now={timer.now} />
          </span>
        </span>
      )}

      {!seat.connected && seat.playerId !== null && !seat.isBot && (
        <i className="offline-dot" title="Disconnected" />
      )}
    </div>
  );
}
