import type { DevelopmentOverviewView, OpenTarget } from "../participant-home-v2/client";
import { followPixelPrimaryTarget } from "../pixel-reference/adapter";
import {
  ImpulsePixelReference,
  type PixelSearchResult,
} from "../pixel-reference/ImpulsePixelReference";
import { usePixelLiveDashboard } from "./usePixelLiveDashboard";
import { usePixelVisualMode } from "./usePixelVisualMode";

export interface PixelParticipantShellProps {
  readonly overview: DevelopmentOverviewView;
  readonly displayName: string;
  readonly roleName: string;
  readonly avatarUrl?: string | null;
  readonly search: string;
  readonly searchResults: readonly PixelSearchResult[];
  readonly onSearchChange: (value: string) => void;
  readonly onSearchSelect: (id: string) => void;
  readonly streakDays?: number | null;
  readonly unreadNotifications: number;
  readonly onOpenStreak?: () => void;
  readonly onOpenNotifications: () => void;
  readonly onOpenNavigation: () => void;
  readonly onOpenTarget: OpenTarget;
  readonly onOpenWorkspace: (canonicalPath?: string) => void;
  readonly buddyAvailable?: boolean;
  readonly onOpenRanking?: () => void;
  readonly onOpenHelp?: () => void;
  readonly onOpenProfile?: () => void;
  readonly onLogout?: () => void;
}

/**
 * Integration-ready source-backed pixel dashboard. The existing App (owner
 * reserved) is responsible for hiding its own old toolbar when mounting this
 * full shell, and passing ONLY authenticated actor data / authorized actions.
 */
export function PixelParticipantShell({
  overview, displayName, roleName, avatarUrl,
  search, searchResults, onSearchChange, onSearchSelect,
  streakDays, unreadNotifications, onOpenStreak, onOpenNotifications,
  onOpenNavigation, onOpenTarget, onOpenWorkspace,
  buddyAvailable = false, onOpenRanking, onOpenHelp, onOpenProfile, onLogout,
}: PixelParticipantShellProps) {
  const { model, loading, partialData } = usePixelLiveDashboard(overview, buddyAvailable);
  const { mode, setMode } = usePixelVisualMode();

  return (
    <div
      data-testid="pixel-live-shell"
      data-loading={loading ? "true" : "false"}
      data-partial-data={partialData ? "true" : "false"}
    >
      <ImpulsePixelReference
        mode={mode}
        onModeChange={setMode}
        displayName={displayName}
        roleName={roleName}
        avatarUrl={avatarUrl}
        search={search}
        searchResults={searchResults}
        onSearchChange={onSearchChange}
        onSearchSelect={onSearchSelect}
        streakDays={streakDays}
        unreadNotifications={unreadNotifications}
        onOpenStreak={onOpenStreak}
        onOpenNotifications={onOpenNotifications}
        onOpenNavigation={onOpenNavigation}
        onOpenJourney={() => { onOpenWorkspace("trajectory"); }}
        onContinue={() => { followPixelPrimaryTarget(overview, onOpenTarget, onOpenWorkspace); }}
        onOpenRequirements={() => { /* Local disclosure; no server mutation. */ }}
        onOpenTasks={() => { onOpenTarget("tasks", ""); }}
        onOpenTools={() => { onOpenWorkspace("trajectory"); }}
        onOpenRanking={onOpenRanking}
        onOpenHelp={onOpenHelp}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
        home={model}
      />
    </div>
  );
}
