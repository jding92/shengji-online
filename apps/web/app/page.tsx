"use client";

import { DEFAULT_PRESET_ID, type GameOptions } from "@shengji/engine";
import type { BotDifficulty } from "@shengji/protocol";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  OptionsEditor,
  type OptionServerIssues,
  type OptionsEditorValue,
} from "../components/options-editor";
import { PresetPicker } from "../components/options-editor";
import { ChromeButton, ChromeLink } from "../components/ui-chrome";
import { ART, art2x } from "../lib/art";
import { fetchPresets, type PresetSummary } from "../lib/presets";
import { safeStorage } from "../lib/safe-storage";
import { sessionKey } from "../lib/session";

const DIFFICULTIES = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
] as const satisfies readonly BotDifficulty[];

const MENU_MODES = [
  { id: "create", label: "Create table" },
  { id: "join", label: "Join table" },
  { id: "practice", label: "Practice" },
  { id: "guide", label: "How to play" },
] as const;

type MenuMode = (typeof MENU_MODES)[number]["id"];

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("intermediate");
  const [menuMode, setMenuMode] = useState<MenuMode>("create");
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [createRules, setCreateRules] = useState<OptionsEditorValue>({
    presetId: DEFAULT_PRESET_ID,
    options: {},
  });
  const [houseRulesOpen, setHouseRulesOpen] = useState(false);
  const [serverIssues, setServerIssues] = useState<OptionServerIssues | undefined>();
  const presetsAttempted = useRef(false);

  const loadPresets = useCallback(
    async (retry = false) => {
      if ((!retry && presetsAttempted.current) || presetsLoading) return;
      presetsAttempted.current = true;
      setPresetsLoading(true);
      setPresetsError(null);
      try {
        const response = await fetchPresets();
        setPresets(response.presets);
      } catch (cause) {
        setPresetsError(
          cause instanceof Error ? cause.message : "Could not load game presets",
        );
      } finally {
        setPresetsLoading(false);
      }
    },
    [presetsLoading],
  );

  useEffect(() => {
    if (menuMode === "create" || menuMode === "practice") void loadPresets();
  }, [loadPresets, menuMode]);

  async function createRoom(practice = false) {
    setCreating(true);
    setError(null);
    setServerIssues(undefined);
    const requestBody: {
      practice?: boolean;
      botDifficulty?: BotDifficulty;
      presetId?: string;
      options?: GameOptions;
    } = practice ? { practice: true, botDifficulty } : {};
    if (createRules.presetId !== DEFAULT_PRESET_ID) {
      requestBody.presetId = createRules.presetId;
    }
    if (Object.keys(createRules.options).length > 0) {
      requestBody.options = createRules.options;
    }
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const body = (await response.json()) as {
        room?: { roomId: string };
        error?: string;
        issues?: readonly { path: string; message: string }[];
      };
      if (!response.ok || body.room === undefined) {
        if (response.status === 400) {
          const issues: OptionServerIssues | undefined =
            body.issues ??
            (body.error === undefined ? undefined : { error: body.error });
          if (issues !== undefined) {
            setServerIssues(issues);
            setHouseRulesOpen(true);
          }
        }
        throw new Error(body.error ?? "Could not create a table");
      }
      if (practice) {
        const joinResponse = await fetch(
          `/api/rooms/${encodeURIComponent(body.room.roomId)}/join`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Player" }),
          },
        );
        const joined = (await joinResponse.json()) as {
          playerToken?: string;
          error?: string;
        };
        if (!joinResponse.ok || joined.playerToken === undefined) {
          throw new Error(joined.error ?? "Could not join the practice table");
        }
        safeStorage.set(sessionKey(body.room.roomId), joined.playerToken);
      }
      router.push(`/room/${body.room.roomId}${practice ? "?practice=1" : ""}`);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Could not create table",
      );
    } finally {
      setCreating(false);
    }
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    const normalized = roomCode.trim().toUpperCase();
    if (normalized.length > 0) router.push(`/room/${normalized}`);
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = MENU_MODES.findIndex(({ id }) => id === menuMode);
    let nextIndex: number;

    if (event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % MENU_MODES.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + MENU_MODES.length) % MENU_MODES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = MENU_MODES.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextMode = MENU_MODES[nextIndex]!;
    setMenuMode(nextMode.id);
    const tabs =
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs[nextIndex]?.focus();
  }

  return (
    <main className="menu-shell">
      <picture className="menu-hero" aria-hidden="true">
        <source
          media="(max-width: 620px)"
          sizes="100vw"
          srcSet={`${ART.home.heroPortrait} 540w, ${art2x(ART.home.heroPortrait)} 1080w`}
        />
        <img
          className="menu-hero-image"
          src={ART.home.heroLandscape}
          srcSet={`${ART.home.heroLandscape} 960w, ${art2x(ART.home.heroLandscape)} 1920w`}
          sizes="100vw"
          alt=""
          fetchPriority="high"
        />
      </picture>
      <motion.section
        className="menu-stage"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <header className="menu-brand">
          <div className="menu-wordmark-frame">
            <img
              className="menu-wordmark"
              src={ART.ui.wordmark}
              srcSet={`${art2x(ART.ui.wordmark)} 2x`}
              alt="Sheng Ji · 升级"
            />
          </div>
          <h1 className="sr-only">Sheng Ji · 升级</h1>
        </header>

        <div className="menu-console">
          <div
            className="menu-mode-list"
            role="tablist"
            aria-label="Game modes"
            aria-orientation="vertical"
            onKeyDown={handleMenuKeyDown}
          >
            {MENU_MODES.map(({ id, label }) => (
              <ChromeButton
                key={id}
                id={`menu-tab-${id}`}
                className="arcade-mode"
                variant={menuMode === id ? "primary" : "neutral"}
                role="tab"
                aria-controls="menu-mode-panel"
                aria-selected={menuMode === id}
                disabled={creating}
                tabIndex={menuMode === id ? 0 : -1}
                onClick={() => setMenuMode(id)}
              >
                <span className="arcade-mode-caret" aria-hidden="true">
                  ▶
                </span>
                <span>{label}</span>
              </ChromeButton>
            ))}
          </div>

          <motion.section
            key={menuMode}
            id="menu-mode-panel"
            className="menu-mode-panel"
            role="tabpanel"
            aria-labelledby={`menu-tab-${menuMode}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {menuMode === "create" && (
              <>
                <p className="menu-panel-kicker">Private match</p>
                <h2>Create a table</h2>
                <p className="menu-panel-copy">
                  Open an invite-only room and bring your crew to the table.
                </p>
                <div className="home-preset-picker">
                  {presets.length > 0 && (
                    <PresetPicker
                      presets={presets}
                      selectedPresetId={createRules.presetId}
                      disabled={creating}
                      onChange={(presetId) => setCreateRules({ presetId, options: {} })}
                    />
                  )}
                  {presetsLoading && <small>Loading presets…</small>}
                  {presetsError && (
                    <p className="inline-error preset-load-error" role="alert">
                      {presetsError}{" "}
                      <ChromeButton
                        className="preset-retry"
                        variant="neutral"
                        disabled={presetsLoading}
                        onClick={() => void loadPresets(true)}
                      >
                        Retry
                      </ChromeButton>
                    </p>
                  )}
                </div>
                <div className="house-rules">
                  <ChromeButton
                    className="house-rules-toggle"
                    variant={houseRulesOpen ? "gold" : "neutral"}
                    aria-expanded={houseRulesOpen}
                    onClick={() => setHouseRulesOpen((open) => !open)}
                  >
                    HOUSE RULES · 自定义
                  </ChromeButton>
                  {houseRulesOpen && (
                    <OptionsEditor
                      presets={presets}
                      phase="lobby"
                      value={createRules}
                      onChange={setCreateRules}
                      occupiedSeats={[]}
                      joinedPlayerCount={0}
                      {...(serverIssues === undefined ? {} : { serverIssues })}
                    />
                  )}
                </div>
                <ChromeButton
                  className="arcade-action"
                  variant="primary"
                  disabled={creating}
                  onClick={() => void createRoom()}
                >
                  <span>{creating ? "Preparing table…" : "Create table"}</span>
                  <b aria-hidden="true">→</b>
                </ChromeButton>
              </>
            )}

            {menuMode === "join" && (
              <form className="menu-panel-form" onSubmit={joinRoom}>
                <p className="menu-panel-kicker">Enter the arena</p>
                <h2>Join a table</h2>
                <label className="arcade-field-label" htmlFor="table-code">
                  Table code
                </label>
                <input
                  id="table-code"
                  className="arcade-field"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={8}
                  placeholder="ENTER CODE"
                  spellCheck={false}
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value)}
                />
                <ChromeButton
                  className="arcade-action"
                  type="submit"
                  variant="primary"
                  disabled={roomCode.trim().length === 0}
                >
                  <span>Join table</span>
                  <b aria-hidden="true">→</b>
                </ChromeButton>
              </form>
            )}

            {menuMode === "practice" && (
              <>
                <p className="menu-panel-kicker">Solo training</p>
                <h2>Choose your rivals</h2>
                <div className="home-preset-picker">
                  {presets.length > 0 && (
                    <PresetPicker
                      presets={presets}
                      selectedPresetId={createRules.presetId}
                      disabled={creating}
                      onChange={(presetId) => setCreateRules({ presetId, options: {} })}
                    />
                  )}
                  {presetsLoading && <small>Loading presets…</small>}
                  {presetsError && (
                    <p className="inline-error preset-load-error" role="alert">
                      {presetsError}{" "}
                      <ChromeButton
                        className="preset-retry"
                        variant="neutral"
                        disabled={presetsLoading}
                        onClick={() => void loadPresets(true)}
                      >
                        Retry
                      </ChromeButton>
                    </p>
                  )}
                </div>
                <fieldset className="difficulty-picker" disabled={creating}>
                  <legend>Practice difficulty</legend>
                  <div className="difficulty-options">
                    {DIFFICULTIES.map((difficulty) => (
                      <ChromeButton
                        key={difficulty}
                        className="difficulty-option"
                        variant={botDifficulty === difficulty ? "gold" : "neutral"}
                        aria-pressed={botDifficulty === difficulty}
                        onClick={() => setBotDifficulty(difficulty)}
                      >
                        {difficulty[0]!.toUpperCase() + difficulty.slice(1)}
                      </ChromeButton>
                    ))}
                  </div>
                </fieldset>
                <ChromeButton
                  className="arcade-action"
                  variant="primary"
                  disabled={creating}
                  onClick={() => void createRoom(true)}
                >
                  <span>{creating ? "Preparing match…" : "Start practice"}</span>
                  <b aria-hidden="true">→</b>
                </ChromeButton>
              </>
            )}

            {menuMode === "guide" && (
              <>
                <p className="menu-panel-kicker">Field manual</p>
                <h2>Learn the game</h2>
                <p className="menu-panel-copy">
                  Master bidding, trump, tractors, throws, and scoring before battle.
                </p>
                <ChromeLink
                  className="arcade-action"
                  variant="primary"
                  href="https://robertying.com/shengji/rules.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Open game guide</span>
                  <b aria-hidden="true">↗</b>
                </ChromeLink>
              </>
            )}
          </motion.section>
        </div>

        {error && (
          <p className="inline-error menu-error" role="alert">
            {error}
          </p>
        )}
      </motion.section>
    </main>
  );
}
