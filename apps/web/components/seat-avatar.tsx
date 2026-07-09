import { portraitForSeat } from "../lib/seat-portraits";

/** Decorative fixed-seat portrait; the adjacent player name remains the label. */
export function SeatAvatar({ seat }: { seat: number }) {
  const portrait = portraitForSeat(seat);
  return (
    <span className="seat-portrait" data-portrait={portrait.id} aria-hidden="true">
      <img src={portrait.src} srcSet={`${portrait.src2x} 2x`} alt="" />
    </span>
  );
}
