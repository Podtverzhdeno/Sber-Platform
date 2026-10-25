import { CircleHelp } from "lucide-react";
import { HELP_TOPICS } from "./participant-help-content";

export function ParticipantHelpTrigger({ topicId, label = "Как это работает?" }: { topicId: string; label?: string }) {
  if (!HELP_TOPICS.some((topic) => topic.id === topicId)) return null;
  return <button type="button" className="pg-topic-shortcut" aria-label={label} title={label}
    onClick={(event) => {
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent("impulse:guide:topic", { detail: { topicId } }));
    }}>
    <CircleHelp size={15} aria-hidden="true" /> {label}
  </button>;
}
