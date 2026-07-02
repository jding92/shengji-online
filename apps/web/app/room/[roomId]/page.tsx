import { PracticeRoomClient } from "../../../components/practice-room-client";
import { RoomClient } from "../../../components/room-client";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ practice?: string }>;
}) {
  const { roomId } = await params;
  const { practice } = await searchParams;
  if (practice !== undefined) {
    return <PracticeRoomClient roomId={roomId.toUpperCase()} />;
  }
  return <RoomClient roomId={roomId.toUpperCase()} />;
}
