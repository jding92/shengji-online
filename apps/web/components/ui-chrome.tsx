import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  PropsWithChildren,
} from "react";
import type { ArtAssetId } from "../lib/art-registry";
import { ART_ASSET_IDS, artAssetPath, artAssetSrcSet } from "../lib/art-registry";

export type ChromePanelAssetId = Extract<ArtAssetId, `ui.chrome.${string}`>;
export type ChromeButtonAssetId = Extract<ArtAssetId, `ui.button.${string}`>;
export type ChromePortraitAssetId = Extract<ArtAssetId, `ui.portrait-frame.${string}`>;

function chromeClassName(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Shared ornamental panel contract. The layout class owns the content box;
 * the active theme supplies its reusable frame and surface treatments.
 */
export function ChromePanel({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={chromeClassName("chrome-panel", className)} {...props} />;
}

/**
 * A panel with an explicit registry-backed artwork layer. The image stays
 * separate from live text/icons so the frame can be replaced independently.
 */
export function ChromeArtPanel({
  asset,
  className,
  contentClassName,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>> & {
  asset: ChromePanelAssetId;
  contentClassName?: string;
}) {
  return (
    <div
      className={chromeClassName("chrome-panel", "chrome-art-panel", className)}
      {...props}
    >
      <img
        className="chrome-art-panel-frame"
        data-chrome-layer="frame"
        data-art-asset={asset}
        src={artAssetPath(asset)}
        srcSet={artAssetSrcSet(asset)}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <div
        className={chromeClassName("chrome-art-panel-content", contentClassName)}
        data-chrome-layer="content"
      >
        {children}
      </div>
    </div>
  );
}

export type ChromeButtonVariant = "primary" | "gold" | "neutral" | "danger";

function ChromeActionSurface({
  asset,
  children,
}: PropsWithChildren<{ asset: ChromeButtonAssetId | null }>) {
  return (
    <>
      {asset !== null && (
        <img
          className="chrome-button-surface"
          data-chrome-layer="surface"
          data-art-asset={asset}
          src={artAssetPath(asset)}
          srcSet={artAssetSrcSet(asset)}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      )}
      <span className="chrome-button-content" data-chrome-layer="content">
        {children}
      </span>
    </>
  );
}

/**
 * Shared button primitive for compact table chrome. Product-level buttons can
 * migrate to this contract without baking their label or icon into an image.
 */
export function ChromeButton({
  children,
  className,
  type = "button",
  variant = "neutral",
  surfaceAsset = ART_ASSET_IDS.buttons[variant],
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ChromeButtonVariant;
  /** Optional interchangeable art slot; live labels and icons stay separate. */
  surfaceAsset?: ChromeButtonAssetId | null;
}) {
  return (
    <button
      type={type}
      className={chromeClassName(
        "chrome-button",
        `chrome-button-${variant}`,
        className,
      )}
      data-chrome-button-surface={surfaceAsset ?? "theme"}
      {...props}
    >
      <ChromeActionSurface asset={surfaceAsset}>{children}</ChromeActionSurface>
    </button>
  );
}

/** Anchor counterpart to ChromeButton for navigational actions. */
export function ChromeLink({
  children,
  className,
  variant = "neutral",
  surfaceAsset = ART_ASSET_IDS.buttons[variant],
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ChromeButtonVariant;
  surfaceAsset?: ChromeButtonAssetId | null;
}) {
  return (
    <a
      className={chromeClassName(
        "chrome-button",
        "chrome-link",
        `chrome-button-${variant}`,
        className,
      )}
      data-chrome-button-surface={surfaceAsset ?? "theme"}
      {...props}
    >
      <ChromeActionSurface asset={surfaceAsset}>{children}</ChromeActionSurface>
    </a>
  );
}

/** A reusable portrait-frame slot; callers provide the portrait itself. */
export function ChromePortrait({
  children,
  className,
  frameAsset = ART_ASSET_IDS.portraitFrame,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLSpanElement>> & {
  frameAsset?: ChromePortraitAssetId;
}) {
  return (
    <span className={chromeClassName("chrome-portrait", className)} {...props}>
      <span className="chrome-portrait-content" data-chrome-layer="portrait">
        {children}
      </span>
      <img
        className="chrome-portrait-frame"
        data-chrome-layer="portrait-frame"
        data-art-asset={frameAsset}
        src={artAssetPath(frameAsset)}
        srcSet={artAssetSrcSet(frameAsset)}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    </span>
  );
}
