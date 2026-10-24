/** Presentation card for the approved "Карьера в IT" announcement found in
 * the provided reference. It is only shown for this specific message title. */
export function MayakiEventPreview() {
  return (
    <div className="msg-mayaki-preview" role="group" aria-label="Анонс встречи «Карьера в IT»">
      <div className="msg-mayaki-preview__mountains" aria-hidden="true">
        <span className="msg-mayaki-preview__star a">✧</span>
        <span className="msg-mayaki-preview__star b">✦</span>
        <span className="msg-mayaki-preview__star c">✧</span>
        <img src="/messages-reference/mayaki-avatar.svg" alt="" />
      </div>
      <span className="msg-mayaki-preview__copy">
        <strong>Карьера в IT:<br/>от обучения<br/>к возможностям</strong>
        <small>Серия встреч · Октябрь 2026</small>
      </span>
    </div>
  );
}
