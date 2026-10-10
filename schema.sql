-- Production PostgreSQL Schema for Meeting Action Item Tracker
-- Run with: psql $DATABASE_URL < schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE action_item_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE meeting_status AS ENUM ('draft', 'processed', 'reviewed');

CREATE TABLE IF NOT EXISTS meetings (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    meeting_date DATE NOT NULL,
    participants TEXT[] NOT NULL DEFAULT '{}',
    transcript TEXT NOT NULL,
    status meeting_status DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

CREATE TABLE IF NOT EXISTS decisions (
    id VARCHAR(64) PRIMARY KEY,
    meeting_id VARCHAR(64) NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    decision TEXT NOT NULL,
    confidence NUMERIC(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    evidence TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_meeting_id ON decisions(meeting_id);

CREATE TABLE IF NOT EXISTS action_items (
    id VARCHAR(64) PRIMARY KEY,
    meeting_id VARCHAR(64) NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    owner VARCHAR(255),
    due_date DATE,
    confidence NUMERIC(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    evidence TEXT,
    status action_item_status DEFAULT 'pending',
    needs_review BOOLEAN DEFAULT FALSE,
    review_reason TEXT,
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_of_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_review ON action_items(needs_review);
CREATE INDEX IF NOT EXISTS idx_action_items_owner ON action_items(owner);
CREATE INDEX IF NOT EXISTS idx_action_items_due ON action_items(due_date);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    meeting_id VARCHAR(64) REFERENCES meetings(id) ON DELETE SET NULL,
    action_item_id VARCHAR(64) REFERENCES action_items(id) ON DELETE SET NULL,
    event VARCHAR(64) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_meeting ON audit_logs(meeting_id);
CREATE INDEX IF NOT EXISTS idx_audit_item ON audit_logs(action_item_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'singleton',
    manual_minutes_per_meeting NUMERIC(5, 2) DEFAULT 10,
    automated_minutes_per_meeting NUMERIC(5, 2) DEFAULT 2,
    confidence_threshold NUMERIC(3, 2) DEFAULT 0.70,
    ai_model VARCHAR(64) DEFAULT 'gemini-3.8-flash',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
