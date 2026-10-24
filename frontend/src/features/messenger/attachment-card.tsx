import { useState } from "react";
import { Check, Copy, ExternalLink, FileSpreadsheet, FileText, Link2, Presentation } from "lucide-react";

/** Message API currently exposes attachment references, not file metadata.
 * Never advertise a download or fabricate a size if the backend only returned
 * an internal artifact key. Direct links are permitted for explicit HTTPS URLs.
 */
function safeExternalUrl(reference: string): string | null {
  try {
    const url = new URL(reference);
    return url.protocol === "https:" && url.hostname.length > 0 ? url.href : null;
  } catch {
    return null;
  }
}

function attachmentDisplayName(reference: string): string {
  const source = reference.split(/[?#]/u)[0] ?? reference;
  const name = source.split("/").pop() ?? reference;
  return name || reference;
}

export function AttachmentCard({ reference }: { reference: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const name = attachmentDisplayName(reference);
  const suffix = name.split(".").pop()?.toLowerCase() ?? "";
  const Icon = ["xls", "xlsx", "csv"].includes(suffix)
    ? FileSpreadsheet
    : ["ppt", "pptx", "odp"].includes(suffix)
      ? Presentation
      : suffix === "pdf" ? FileText : Link2;
  const url = safeExternalUrl(reference);
  const copy = () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(reference);
        setStatus("copied");
      } catch {
        setStatus("failed");
      }
    })();
  };
  return (
    <li className="msg-chat__artifact-ref">
      <span className="msg-chat__artifact-icon"><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span>
      <span className="msg-chat__artifact-label" title={reference}>
        <strong>{name}</strong>
        <small>{suffix && suffix !== name.toLowerCase() ? suffix.toUpperCase() + " · " : ""}{url ? "Внешняя ссылка" : "Идентификатор вложения"}</small>
      </span>
      {url ? (
        <a className="msg-chat__artifact-action" href={url} target="_blank" rel="noopener noreferrer"
          aria-label={`Открыть вложение ${name} в новой вкладке`}>
          <ExternalLink size={19} />
        </a>
      ) : (
        <button type="button" className="msg-chat__artifact-action" onClick={copy}
          aria-label={`Скопировать идентификатор вложения ${name}`}>
          {status === "copied" ? <Check size={19} /> : <Copy size={19} />}
        </button>
      )}
      {status !== "idle" && (
        <span role="status" className="msg-chat__artifact-status">
          {status === "copied" ? "Идентификатор скопирован" : "Скопировать не удалось"}
        </span>
      )}
    </li>
  );
}
