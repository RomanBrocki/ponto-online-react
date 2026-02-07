type ModalProps = {
  title: string;
  message: string;
  onClose: () => void;
  details?: string[];
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

export default function Modal({
  title,
  message,
  onClose,
  details,
  onConfirm,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
}: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        <p>{message}</p>
        {details?.length ? (
          <ul className="modal-list">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
        <div className="modal-actions">
          {onConfirm ? (
            <>
              <button type="button" className="button-muted" onClick={onClose}>
                {cancelLabel}
              </button>
              <button type="button" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </>
          ) : (
            <button type="button" onClick={onClose}>
              Fechar
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
