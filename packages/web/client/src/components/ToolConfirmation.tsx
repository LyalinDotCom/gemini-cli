/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

interface ToolConfirmationProps {
  toolName: string;
  toolArgs: Record<string, unknown>;
  onConfirm: () => void;
  onReject: () => void;
}

export default function ToolConfirmation({
  toolName,
  toolArgs,
  onConfirm,
  onReject,
}: ToolConfirmationProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Tool Confirmation Required</h3>
        <div className="modal-body">
          <p>
            The assistant wants to execute: <strong>{toolName}</strong>
          </p>
          {Object.keys(toolArgs).length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ marginBottom: '4px', color: 'var(--text-muted)' }}>
                Arguments:
              </div>
              <pre
                style={{
                  background: 'var(--bg-tertiary)',
                  padding: '8px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px',
                }}
              >
                {JSON.stringify(toolArgs, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={onReject}>
            Reject
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
