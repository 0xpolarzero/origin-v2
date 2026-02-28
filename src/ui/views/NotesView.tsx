import { useState, useMemo } from "react";
import * as React from "react";
import type { Note } from "../../core/domain/note";

interface NotesViewProps {
  notes: ReadonlyArray<Note>;
  onCreateNote: (body: string, linkedEntityRefs?: string[]) => void;
  onUpdateNote: (noteId: string, body: string) => void;
  onLinkEntity: (noteId: string, entityRef: string) => void;
  onUnlinkEntity: (noteId: string, entityRef: string) => void;
  onDeleteNote?: (noteId: string) => void;
  availableEntities?: ReadonlyArray<{ ref: string; label: string }>;
  filters?: { linkedEntityRef?: string };
}

const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString();
};

const getPreview = (body: string, maxLength = 120): string => {
  if (body.length <= maxLength) return body;
  return body.slice(0, maxLength) + "...";
};

const parseEntityRef = (ref: string): { type: string; id: string } => {
  const parts = ref.split(":");
  return { type: parts[0] ?? "unknown", id: parts[1] ?? ref };
};

export function NotesView({
  notes,
  onCreateNote,
  onUpdateNote,
  onLinkEntity,
  onUnlinkEntity,
  onDeleteNote,
  availableEntities,
  filters,
}: NotesViewProps): React.ReactElement {
  const [isCreating, setIsCreating] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [newLinkedRefs, setNewLinkedRefs] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [linkingNoteId, setLinkingNoteId] = useState<string | null>(null);
  const [selectedEntityRef, setSelectedEntityRef] = useState("");

  const filteredNotes = useMemo(() => {
    let result = notes;

    if (filters?.linkedEntityRef) {
      result = result.filter((note) =>
        note.linkedEntityRefs.includes(filters.linkedEntityRef!),
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((note) => note.body.toLowerCase().includes(query));
    }

    return result;
  }, [notes, filters, searchQuery]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBody.trim()) {
      onCreateNote(
        newBody.trim(),
        newLinkedRefs.length > 0 ? newLinkedRefs : undefined,
      );
      setNewBody("");
      setNewLinkedRefs([]);
      setIsCreating(false);
    }
  };

  const handleExpand = (note: Note) => {
    if (expandedId === note.id) {
      setExpandedId(null);
    } else {
      setExpandedId(note.id);
      setEditBody(note.body);
    }
  };

  const handleUpdateSubmit = (noteId: string) => {
    if (editBody.trim()) {
      onUpdateNote(noteId, editBody.trim());
      setExpandedId(null);
    }
  };

  const handleCancelEdit = () => {
    setExpandedId(null);
    setEditBody("");
  };

  const handleAddLinkToNewNote = (ref: string) => {
    if (!newLinkedRefs.includes(ref)) {
      setNewLinkedRefs([...newLinkedRefs, ref]);
    }
  };

  const handleRemoveLinkFromNewNote = (ref: string) => {
    setNewLinkedRefs(newLinkedRefs.filter((r) => r !== ref));
  };

  const handleLinkEntity = (noteId: string) => {
    if (selectedEntityRef) {
      onLinkEntity(noteId, selectedEntityRef);
      setSelectedEntityRef("");
      setLinkingNoteId(null);
    }
  };

  const availableEntitiesForLinking = useMemo(() => {
    if (!availableEntities) return [];
    const currentNote = notes.find((n) => n.id === linkingNoteId);
    if (!currentNote) return availableEntities;
    return availableEntities.filter(
      (e) => !currentNote.linkedEntityRefs.includes(e.ref),
    );
  }, [availableEntities, linkingNoteId, notes]);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Notes</h2>
        <div className="view-stats">
          <span>{filteredNotes.length} notes</span>
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          className="form-input search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes..."
        />
        {filters?.linkedEntityRef && (
          <span className="filter-tag">
            Linked to: {parseEntityRef(filters.linkedEntityRef).type} -
            {parseEntityRef(filters.linkedEntityRef).id}
          </span>
        )}
      </div>

      <div className="list-container">
        {filteredNotes.length === 0 ? (
          <div className="empty-state">
            {searchQuery ? "No notes match your search" : "No notes found"}
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div key={note.id} className="list-item card">
              {expandedId === note.id ? (
                <div className="note-edit">
                  <textarea
                    className="form-textarea"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={6}
                    autoFocus
                  />
                  <div className="linked-entities-section">
                    <h4>Linked Entities</h4>
                    {note.linkedEntityRefs.length === 0 ? (
                      <span className="no-entities">No linked entities</span>
                    ) : (
                      <div className="entity-tags">
                        {note.linkedEntityRefs.map((ref) => {
                          const { type, id } = parseEntityRef(ref);
                          return (
                            <span key={ref} className="entity-tag">
                              {type}:{id}
                              <button
                                type="button"
                                className="unlink-btn"
                                onClick={() => onUnlinkEntity(note.id, ref)}
                                aria-label={`Unlink ${ref}`}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {linkingNoteId === note.id ? (
                      <div className="link-entity-form">
                        <select
                          className="form-input"
                          value={selectedEntityRef}
                          onChange={(e) => setSelectedEntityRef(e.target.value)}
                        >
                          <option value="">Select entity...</option>
                          {availableEntitiesForLinking.map((entity) => (
                            <option key={entity.ref} value={entity.ref}>
                              {entity.label} ({entity.ref})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleLinkEntity(note.id)}
                          disabled={!selectedEntityRef}
                        >
                          Link
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setLinkingNoteId(null);
                            setSelectedEntityRef("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      availableEntities && availableEntities.length > 0 && (
                        <button
                          type="button"
                          className="btn-secondary link-btn"
                          onClick={() => setLinkingNoteId(note.id)}
                        >
                          + Link Entity
                        </button>
                      )
                    )}
                  </div>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleUpdateSubmit(note.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                    {onDeleteNote && (
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => {
                          onDeleteNote(note.id);
                          setExpandedId(null);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="note-preview"
                  onClick={() => handleExpand(note)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleExpand(note);
                    }
                  }}
                >
                  <p className="note-body">{getPreview(note.body)}</p>
                  {note.linkedEntityRefs.length > 0 && (
                    <div className="entity-tags-preview">
                      {note.linkedEntityRefs.map((ref) => {
                        const { type, id } = parseEntityRef(ref);
                        return (
                          <span key={ref} className="entity-tag mini">
                            {type}:{id}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="item-meta">
                    <span className="date-badge">
                      Updated: {formatDate(note.updatedAt)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="view-footer">
        {isCreating ? (
          <form onSubmit={handleCreateSubmit} className="create-form card">
            <h3>Create New Note</h3>
            <textarea
              className="form-textarea"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Write your note..."
              rows={4}
              autoFocus
            />
            {availableEntities && availableEntities.length > 0 && (
              <div className="link-entities-section">
                <h4>Link Entities</h4>
                {newLinkedRefs.length > 0 && (
                  <div className="entity-tags">
                    {newLinkedRefs.map((ref) => {
                      const { type, id } = parseEntityRef(ref);
                      return (
                        <span key={ref} className="entity-tag">
                          {type}:{id}
                          <button
                            type="button"
                            className="unlink-btn"
                            onClick={() => handleRemoveLinkFromNewNote(ref)}
                            aria-label={`Remove ${ref}`}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <select
                  className="form-input"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddLinkToNewNote(e.target.value);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">Add link to...</option>
                  {availableEntities
                    .filter((e) => !newLinkedRefs.includes(e.ref))
                    .map((entity) => (
                      <option key={entity.ref} value={entity.ref}>
                        {entity.label} ({entity.ref})
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Create
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsCreating(false);
                  setNewBody("");
                  setNewLinkedRefs([]);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="btn-primary create-btn"
            onClick={() => setIsCreating(true)}
          >
            + New Note
          </button>
        )}
      </div>
    </div>
  );
}
