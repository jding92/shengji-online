"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { GameMoment } from "../lib/moments";
import { safeStorage } from "../lib/safe-storage";
import { SOUND_REGISTRY, type SoundEvent } from "../lib/sounds";

const MUTED_STORAGE_KEY = "shengji-muted";
const MAX_PLAYED_MOMENTS = 8;
const muteListeners = new Set<() => void>();

let audioContext: AudioContext | null = null;
const decodedBuffers = new Map<string, AudioBuffer>();
let audioReady = false;
let readyPromise: Promise<AudioContext | null> | null = null;

function readMutedPreference(): boolean {
  return safeStorage.get(MUTED_STORAGE_KEY) === "1";
}

function subscribeMuted(listener: () => void): () => void {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
}

function writeMutedPreference(muted: boolean): void {
  safeStorage.set(MUTED_STORAGE_KEY, muted ? "1" : "0");
  muteListeners.forEach((listener) => listener());
}

function hasConfiguredSounds(): boolean {
  return Object.values(SOUND_REGISTRY).some((entry) => entry !== null);
}

function getAudioContext(): AudioContext | null {
  if (audioContext !== null) return audioContext;
  if (!hasConfiguredSounds()) return null;
  audioContext = new AudioContext();
  return audioContext;
}

function prepareAudio(): Promise<AudioContext | null> {
  readyPromise ??= Promise.resolve()
    .then(getAudioContext)
    .then(async (context) => {
      if (context?.state === "suspended") await context.resume();
      audioReady = context !== null;
      return context;
    })
    .catch(() => null);
  return readyPromise;
}

async function bufferFor(src: string, context: AudioContext): Promise<AudioBuffer> {
  const cached = decodedBuffers.get(src);
  if (cached !== undefined) return cached;
  const response = await fetch(src);
  const arrayBuffer = await response.arrayBuffer();
  const decoded = await context.decodeAudioData(arrayBuffer);
  decodedBuffers.set(src, decoded);
  return decoded;
}

async function playSound(event: SoundEvent): Promise<void> {
  const entry = SOUND_REGISTRY[event];
  if (entry === null || !audioReady) return;
  const context = await prepareAudio();
  if (context === null) return;
  const buffer = await bufferFor(entry.src, context);
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = entry.volume;
  source.buffer = buffer;
  source.connect(gain).connect(context.destination);
  source.start();
}

export function useSoundPreference(): {
  muted: boolean;
  toggleMuted: () => void;
  setMuted: (muted: boolean) => void;
} {
  const muted = useSyncExternalStore(subscribeMuted, readMutedPreference, () => false);

  const setMuted = useCallback((nextMuted: boolean) => {
    writeMutedPreference(nextMuted);
  }, []);

  const toggleMuted = useCallback(() => {
    writeMutedPreference(!readMutedPreference());
  }, []);

  return { muted, toggleMuted, setMuted };
}

export function useSoundEffects(moments: GameMoment[]): void {
  const { muted } = useSoundPreference();
  const playedMomentIds = useRef<string[]>([]);

  useEffect(() => {
    if (muted || !hasConfiguredSounds()) return;
    const handleFirstGesture = () => {
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
      void prepareAudio();
    };
    window.addEventListener("pointerdown", handleFirstGesture, { once: true });
    window.addEventListener("keydown", handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
    };
  }, [muted]);

  useEffect(() => {
    if (moments.length === 0) return;
    const seen = new Set(playedMomentIds.current);
    const newMoments = moments.filter((moment) => !seen.has(moment.id));
    if (newMoments.length === 0) return;

    playedMomentIds.current = [
      ...playedMomentIds.current,
      ...newMoments.map(({ id }) => id),
    ].slice(-MAX_PLAYED_MOMENTS);

    if (muted) return;
    for (const moment of newMoments) {
      const entry = SOUND_REGISTRY[moment.type];
      if (entry === null) continue;
      void playSound(moment.type).catch(() => {
        // Missing or undecodable future assets should not break gameplay.
      });
    }
  }, [moments, muted]);
}
