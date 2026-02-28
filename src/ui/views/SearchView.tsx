import * as React from "react";
const { useState, useEffect, useCallback, useMemo } = React;

interface SearchViewProps {
  query: string;
  results: ReadonlyArray<{
    entityType: string;
    entityId: string;
    preview: string;
  }>;
  scannedEntityTypes: ReadonlyArray<string>;
  onSearch: (query: string, options?: { entityTypes?: string[]; limit?: number }) => void;
  onSelectResult: (entityType: string, entityId: string) => void;
  onClearSearch: () => void;
}

const DEBOUNCE_MS = 300;

const formatEntityType = (type: string): string => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const getEntityIcon = (entityType: string): string => {
  switch (entityType) {
    case "task":
      return "☑";
    case "project":
      return "📁";
    case "note":
      return "📝";
    case "event":
      return "📅";
    case "entry":
      return "📄";
    case "signal":
      return "📡";
    case "job":
      return "⚙";
    case "notification":
      return "🔔";
    default:
      return "📎";
  }
};

const HighlightText = ({
  text,
  query,
}: {
  text: string;
  query: string;
}): React.ReactElement => {
  if (!query.trim()) {
    return <>{text}</>;
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="search-highlight">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
};

const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export function SearchView({
  query,
  results,
  scannedEntityTypes,
  onSearch,
  onSelectResult,
  onClearSearch,
}: SearchViewProps): React.ReactElement {
  const [inputValue, setInputValue] = useState(query);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(scannedEntityTypes),
  );
  const [recentSearches, setRecentSearches] = useState<ReadonlyArray<string>>([]);

  useEffect(() => {
    const saved = localStorage.getItem("origin_recent_searches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue.trim()) {
        onSearch(inputValue.trim(), {
          entityTypes: Array.from(selectedTypes),
        });
      } else {
        onClearSearch();
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [inputValue, selectedTypes, onSearch, onClearSearch]);

  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setRecentSearches((prev) => {
      const updated = [
        searchQuery,
        ...prev.filter((s) => s !== searchQuery),
      ].slice(0, 5);
      localStorage.setItem("origin_recent_searches", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      saveRecentSearch(inputValue.trim());
      onSearch(inputValue.trim(), {
        entityTypes: Array.from(selectedTypes),
      });
    }
  };

  const handleTypeToggle = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleSelectAllTypes = () => {
    setSelectedTypes(new Set(scannedEntityTypes));
  };

  const handleClearTypes = () => {
    setSelectedTypes(new Set());
  };

  const handleResultClick = (entityType: string, entityId: string) => {
    saveRecentSearch(inputValue.trim());
    onSelectResult(entityType, entityId);
  };

  const handleClear = () => {
    setInputValue("");
    onClearSearch();
  };

  const groupedResults = useMemo(() => {
    const groups: Record<string, Array<{ entityType: string; entityId: string; preview: string }>> = {};
    for (const result of results) {
      if (!groups[result.entityType]) {
        groups[result.entityType] = [];
      }
      groups[result.entityType].push(result);
    }
    return groups;
  }, [results]);

  const hasActiveFilters = selectedTypes.size !== scannedEntityTypes.length;

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Search</h2>
      </div>

      <form onSubmit={handleSearchSubmit} className="search-form">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="form-input search-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search across all entities..."
            autoFocus
          />
          {inputValue && (
            <button
              type="button"
              className="clear-input-btn"
              onClick={handleClear}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      <div className="filter-section">
        <div className="filter-header">
          <span className="filter-label">Filter by type:</span>
          <div className="filter-actions">
            <button
              type="button"
              className="btn-link"
              onClick={handleSelectAllTypes}
            >
              Select all
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={handleClearTypes}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="entity-type-filters">
          {scannedEntityTypes.map((type) => (
            <label key={type} className="type-checkbox">
              <input
                type="checkbox"
                checked={selectedTypes.has(type)}
                onChange={() => handleTypeToggle(type)}
              />
              <span className="type-label">
                {getEntityIcon(type)} {formatEntityType(type)}
              </span>
            </label>
          ))}
        </div>
        {hasActiveFilters && (
          <div className="active-filters">
            Searching {selectedTypes.size} of {scannedEntityTypes.length} types
          </div>
        )}
      </div>

      <div className="search-results">
        {query && results.length === 0 ? (
          <div className="empty-state">
            <p>No results found for &quot;{query}&quot;</p>
            <div className="search-suggestions">
              <p>Suggestions:</p>
              <ul>
                <li>Check your spelling</li>
                <li>Try different keywords</li>
                <li>Broaden your search criteria</li>
                <li>Check which entity types are selected</li>
              </ul>
            </div>
          </div>
        ) : !query && recentSearches.length > 0 ? (
          <div className="recent-searches">
            <h3>Recent Searches</h3>
            <div className="recent-list">
              {recentSearches.map((search) => (
                <button
                  key={search}
                  type="button"
                  className="recent-item"
                  onClick={() => setInputValue(search)}
                >
                  <span className="recent-icon">🔍</span>
                  {search}
                </button>
              ))}
            </div>
          </div>
        ) : !query ? (
          <div className="empty-state">
            <p>Start typing to search across all your data</p>
            <div className="search-tips">
              <p>Tips:</p>
              <ul>
                <li>Use specific keywords for better results</li>
                <li>Filter by entity type to narrow results</li>
                <li>Recent searches will appear here</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="results-container">
            <div className="results-header">
              <span>
                {results.length} result{results.length !== 1 ? "s" : ""} for &quot;
                {query}&quot;
              </span>
            </div>
            {Object.entries(groupedResults).map(([entityType, items]) => (
              <div key={entityType} className="result-group">
                <h3 className="result-group-header">
                  {getEntityIcon(entityType)} {formatEntityType(entityType)} (
                  {items.length})
                </h3>
                <div className="result-group-items">
                  {items.map((result) => (
                    <button
                      key={`${result.entityType}-${result.entityId}`}
                      type="button"
                      className="result-item"
                      onClick={() =>
                        handleResultClick(result.entityType, result.entityId)
                      }
                    >
                      <div className="result-id">{result.entityId}</div>
                      <div className="result-preview">
                        <HighlightText text={result.preview} query={query} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
