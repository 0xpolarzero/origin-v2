import * as React from "react";
const { useState, useCallback } = React;
import type { SettingsValue } from "../workflows/settings-surface";

interface SettingsViewProps {
  settings: Record<string, SettingsValue>;
  onSaveSettings: (values: Record<string, SettingsValue>) => void;
  aiEnabled: boolean;
}

type AIProvider = "openai" | "anthropic" | "google" | "local";

interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  modelId: string;
  maxTokens: number;
  timeoutMs: number;
  temperature: number;
}

const AI_PROVIDERS: ReadonlyArray<{ value: AIProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "local", label: "Local" },
];

const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: "openai",
  modelId: "",
  maxTokens: 2000,
  timeoutMs: 30000,
  temperature: 0.7,
};

const parseAISettings = (settings: Record<string, SettingsValue>): AISettings => {
  const ai = settings.ai;
  if (typeof ai !== "object" || ai === null || Array.isArray(ai)) {
    return DEFAULT_AI_SETTINGS;
  }
  const aiRecord = ai as Record<string, unknown>;
  return {
    enabled: typeof aiRecord.enabled === "boolean" ? aiRecord.enabled : false,
    provider: (typeof aiRecord.provider === "string" &&
      ["openai", "anthropic", "google", "local"].includes(aiRecord.provider))
      ? (aiRecord.provider as AIProvider)
      : "openai",
    modelId: typeof aiRecord.modelId === "string" ? aiRecord.modelId : "",
    maxTokens: typeof aiRecord.maxTokens === "number" ? aiRecord.maxTokens : 2000,
    timeoutMs: typeof aiRecord.timeoutMs === "number" ? aiRecord.timeoutMs : 30000,
    temperature: typeof aiRecord.temperature === "number" ? aiRecord.temperature : 0.7,
  };
};

export function SettingsView({
  settings,
  onSaveSettings,
  aiEnabled,
}: SettingsViewProps): React.ReactElement {
  const [aiSettings, setAiSettings] = useState<AISettings>(() =>
    parseAISettings(settings)
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateAISetting = useCallback(<K extends keyof AISettings>(
    key: K,
    value: AISettings[K]
  ) => {
    setAiSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaveStatus("idle");
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (aiSettings.enabled) {
      if (aiSettings.modelId.trim().length === 0) {
        newErrors.modelId = "Model ID is required when AI is enabled";
      }
      if (!Number.isInteger(aiSettings.maxTokens) || aiSettings.maxTokens < 1) {
        newErrors.maxTokens = "Max tokens must be a positive integer";
      }
      if (!Number.isInteger(aiSettings.timeoutMs) || aiSettings.timeoutMs < 1000) {
        newErrors.timeoutMs = "Timeout must be at least 1000ms";
      }
      if (aiSettings.temperature < 0 || aiSettings.temperature > 1) {
        newErrors.temperature = "Temperature must be between 0 and 1";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [aiSettings]);

  const handleSave = useCallback(() => {
    if (!validate()) {
      return;
    }

    setSaveStatus("saving");
    const newSettings: Record<string, SettingsValue> = {
      ...settings,
      ai: { ...aiSettings },
    };
    onSaveSettings(newSettings);
    setHasChanges(false);
    setSaveStatus("saved");

    setTimeout(() => {
      setSaveStatus("idle");
    }, 2000);
  }, [aiSettings, onSaveSettings, settings, validate]);

  const getProviderHelperText = (provider: AIProvider): string => {
    switch (provider) {
      case "openai":
        return "Use OpenAI's GPT models for AI suggestions";
      case "anthropic":
        return "Use Anthropic's Claude models for AI suggestions";
      case "google":
        return "Use Google's Gemini models for AI suggestions";
      case "local":
        return "Use a locally hosted model via API";
      default:
        return "";
    }
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Settings</h2>
        <div className="view-stats">
          {hasChanges && <span className="unsaved-indicator">Unsaved changes</span>}
          {saveStatus === "saved" && <span className="saved-indicator">Saved</span>}
        </div>
      </div>

      <div className="settings-section">
        <h3>AI Configuration</h3>
        <p className="section-description">
          Configure AI settings for the capture→suggest→accept workflow.
          When disabled, no AI calls are made.
        </p>

        <div className="form-group">
          <label className="form-label">
            <input
              type="checkbox"
              className="form-toggle"
              checked={aiSettings.enabled}
              onChange={(e) => updateAISetting("enabled", e.target.checked)}
              disabled={!aiEnabled}
            />
            Enable AI
          </label>
          {!aiEnabled && (
            <span className="helper-text warning">AI is disabled at the system level</span>
          )}
          {aiSettings.enabled && (
            <span className="helper-text success">AI is enabled and will generate suggestions</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ai-provider">
            Provider
          </label>
          <select
            id="ai-provider"
            className="form-select"
            value={aiSettings.provider}
            onChange={(e) => updateAISetting("provider", e.target.value as AIProvider)}
            disabled={!aiSettings.enabled}
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="helper-text">{getProviderHelperText(aiSettings.provider)}</span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ai-model-id">
            Model ID
          </label>
          <input
            id="ai-model-id"
            type="text"
            className={`form-input ${errors.modelId ? "error" : ""}`}
            value={aiSettings.modelId}
            onChange={(e) => updateAISetting("modelId", e.target.value)}
            placeholder="e.g., gpt-4, claude-3-opus-20240229"
            disabled={!aiSettings.enabled}
          />
          {errors.modelId && <span className="error-text">{errors.modelId}</span>}
          <span className="helper-text">The specific model to use for AI generation</span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ai-max-tokens">
            Max Tokens
          </label>
          <input
            id="ai-max-tokens"
            type="number"
            className={`form-input ${errors.maxTokens ? "error" : ""}`}
            value={aiSettings.maxTokens}
            onChange={(e) => updateAISetting("maxTokens", parseInt(e.target.value, 10) || 0)}
            min={1}
            disabled={!aiSettings.enabled}
          />
          {errors.maxTokens && <span className="error-text">{errors.maxTokens}</span>}
          <span className="helper-text">Maximum number of tokens in the AI response</span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ai-timeout">
            Timeout (ms)
          </label>
          <input
            id="ai-timeout"
            type="number"
            className={`form-input ${errors.timeoutMs ? "error" : ""}`}
            value={aiSettings.timeoutMs}
            onChange={(e) => updateAISetting("timeoutMs", parseInt(e.target.value, 10) || 0)}
            min={1000}
            step={1000}
            disabled={!aiSettings.enabled}
          />
          {errors.timeoutMs && <span className="error-text">{errors.timeoutMs}</span>}
          <span className="helper-text">Timeout for AI requests in milliseconds</span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ai-temperature">
            Temperature
          </label>
          <input
            id="ai-temperature"
            type="number"
            className={`form-input ${errors.temperature ? "error" : ""}`}
            value={aiSettings.temperature}
            onChange={(e) => updateAISetting("temperature", parseFloat(e.target.value) || 0)}
            min={0}
            max={1}
            step={0.1}
            disabled={!aiSettings.enabled}
          />
          {errors.temperature && <span className="error-text">{errors.temperature}</span>}
          <span className="helper-text">
            Controls randomness: 0 = deterministic, 1 = most random
          </span>
        </div>
      </div>

      <div className="settings-section">
        <h3>General Settings</h3>
        <p className="section-description">
          Additional application settings can be configured here.
        </p>
      </div>

      <div className="settings-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={!hasChanges || saveStatus === "saving"}
        >
          {saveStatus === "saving" ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
