import { safeStorage } from "./safe-storage";

export function sessionKey(roomId: string): string {
  return `shengji:session:${roomId.toUpperCase()}`;
}

export function roomSessionToken(roomId: string): string | null {
  return safeStorage.get(sessionKey(roomId));
}
