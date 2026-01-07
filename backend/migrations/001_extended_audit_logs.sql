-- Migration: Create extended_audit_logs table for Rust audit service
CREATE TABLE IF NOT EXISTS extended_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    action VARCHAR(255) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    scope VARCHAR(255),
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_audit_user_id ON extended_audit_logs(user_id);
CREATE INDEX idx_audit_action ON extended_audit_logs(action);
CREATE INDEX idx_audit_created_at ON extended_audit_logs(created_at DESC);
CREATE INDEX idx_audit_scope ON extended_audit_logs(scope);

-- Cleanup policy: Partition by month for easier retention management (optional)
-- For now, we'll use a simple retention trigger via scheduled cleanup

COMMIT;
