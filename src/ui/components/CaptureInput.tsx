import * as React from "react";

export interface CaptureInputProps {
  onCapture: (content: string) => void;
  aiEnabled: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export const CaptureInput: React.FC<CaptureInputProps> = ({
  onCapture,
  aiEnabled,
  placeholder = "Quick capture...",
  disabled = false,
}) => {
  const [content, setContent] = React.useState("");
  const [isCapturing, setIsCapturing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleCapture = async () => {
    const trimmed = content.trim();
    if (!trimmed || isCapturing) return;

    setIsCapturing(true);
    try {
      await Promise.resolve(onCapture(trimmed));
      setContent("");
      // Focus back on input after capture
      inputRef.current?.focus();
    } finally {
      setIsCapturing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCapture();
    }
  };

  const isEmpty = !content.trim();

  return (
    <div className="capture-input-container" data-testid="capture-input">
      <div className="capture-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="capture-input"
          placeholder={placeholder}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isCapturing}
          aria-label="Capture input"
          aria-busy={isCapturing}
        />
        <button
          type="button"
          className="capture-submit-btn"
          onClick={handleCapture}
          disabled={isEmpty || disabled || isCapturing}
          aria-label="Capture entry"
        >
          {isCapturing ? (
            <span className="capture-spinner" aria-hidden="true">
              ⟳
            </span>
          ) : (
            "Capture"
          )}
        </button>
      </div>

      {aiEnabled && (
        <div className="capture-ai-indicator" aria-label="AI assistance enabled">
          <span className="ai-indicator-icon">✨</span>
          <span className="ai-indicator-text">AI will suggest</span>
        </div>
      )}
    </div>
  );
};
