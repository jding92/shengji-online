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
  return (
    <RoomClient roomId={roomId.toUpperCase()} autoStart={practice !== undefined} />
  );
}
