/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavItem } from './components/layout/Sidebar.tsx';
import { Header } from './components/layout/Header.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { NewMeetingView } from './components/meetings/NewMeetingView.tsx';
import { MeetingReviewView } from './components/meetings/MeetingReviewView.tsx';
import { MeetingsListView } from './components/meetings/MeetingsListView.tsx';
import { ActionItemsListView } from './components/action-items/ActionItemsListView.tsx';
import { AnalyticsView } from './components/analytics/AnalyticsView.tsx';
import { AuditLogView } from './components/audit/AuditLogView.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { SupabaseModal } from './components/supabase/SupabaseModal.tsx';
import { RainbowStarCursor } from './components/common/RainbowStarCursor.tsx';
import { api } from './lib/api.ts';
import {
  Meeting,
  ActionItem,
  Decision,
  AuditLog,
  DashboardMetrics,
  SystemSettings,
} from './types/index.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false);

  // Core Data
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Selected Meeting Review Data
  const [selectedMeetingData, setSelectedMeetingData] = useState<{
    meeting: Meeting;
    decisions: Decision[];
    actionItems: ActionItem[];
    auditLogs: AuditLog[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all primary data
  const loadPrimaryData = useCallback(async () => {
    try {
      const [mtgs, acts, mets, logs, sets] = await Promise.all([
        api.getMeetings(),
        api.getActionItems(),
        api.getMetrics(),
        api.getAuditLogs(100),
        api.getSettings(),
      ]);
      setMeetings(mtgs);
      setActionItems(acts);
      setMetrics(mets);
      setAuditLogs(logs);
      setSettings(sets);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrimaryData();
  }, [loadPrimaryData]);

  // Load specific meeting when selectedMeetingId changes
  const loadSelectedMeeting = useCallback(async (id: string) => {
    try {
      const details = await api.getMeeting(id);
      setSelectedMeetingData(details);
    } catch (err: any) {
      console.error('Failed to load meeting details:', err);
      alert(`Could not load meeting: ${err.message}`);
      setSelectedMeetingId(null);
    }
  }, []);

  useEffect(() => {
    if (selectedMeetingId) {
      loadSelectedMeeting(selectedMeetingId);
    } else {
      setSelectedMeetingData(null);
    }
  }, [selectedMeetingId, loadSelectedMeeting]);

  // Handlers
  const handleSelectMeeting = (id: string) => {
    setSelectedMeetingId(id);
  };

  const handleBackFromMeeting = () => {
    setSelectedMeetingId(null);
    loadPrimaryData();
  };

  const handleExtractionSuccess = async (newMeetingId: string) => {
    await loadPrimaryData();
    setSelectedMeetingId(newMeetingId);
  };

  const handleCompleteAction = async (id: string) => {
    try {
      await api.completeActionItem(id);
      await loadPrimaryData();
      if (selectedMeetingId) {
        await loadSelectedMeeting(selectedMeetingId);
      }
    } catch (err: any) {
      alert(`Error updating action item: ${err.message}`);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    try {
      await api.deleteMeeting(id);
      if (selectedMeetingId === id) {
        setSelectedMeetingId(null);
      }
      await loadPrimaryData();
    } catch (err: any) {
      alert(`Error deleting meeting: ${err.message}`);
    }
  };

  const handleSeedData = async () => {
    await api.seedData();
    setSelectedMeetingId(null);
    await loadPrimaryData();
  };

  const pendingCount = actionItems.filter((a) => a.status === 'pending').length;
  const reviewCount = actionItems.filter((a) => a.needsReview).length;

  const getPageTitle = () => {
    if (selectedMeetingId && selectedMeetingData) {
      return 'Meeting Extraction Review';
    }
    switch (currentTab) {
      case 'dashboard':
        return 'Executive Overview';
      case 'new-meeting':
        return 'New Meeting Extraction';
      case 'meetings':
        return 'Meeting Directory';
      case 'action-items':
        return 'Universal Action Items';
      case 'analytics':
        return 'Operational Analytics & ROI';
      case 'audit-log':
        return 'Security & Audit Trail';
      case 'settings':
        return 'System Settings & Assumptions';
      default:
        return 'EchoScribe';
    }
  };

  const getPageSubtitle = () => {
    if (selectedMeetingId && selectedMeetingData) {
      return `Reviewing: ${selectedMeetingData.meeting.title}`;
    }
    switch (currentTab) {
      case 'dashboard':
        return 'Real-time KPIs, AI confidence distributions, and deliverable throughput.';
      case 'new-meeting':
        return 'Run Gemini 3.8 Flash to extract decisions, assignees, deadlines, and flags.';
      case 'meetings':
        return 'All processed meeting transcripts with deliverable summaries.';
      case 'action-items':
        return 'Filter by pending, completed, overdue, and items requiring review.';
      case 'analytics':
        return 'Evaluate AI accuracy, user override rates, and estimated engineering hours saved.';
      case 'audit-log':
        return 'Cryptographically logged events for SOC 2 compliance.';
      case 'settings':
        return 'Configure time saved baseline and model parameters.';
      default:
        return undefined;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100/70 font-sans text-slate-800 antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setSelectedMeetingId(null);
          setCurrentTab(tab);
        }}
        pendingCount={pendingCount}
        reviewCount={reviewCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          title={getPageTitle()}
          subtitle={getPageSubtitle()}
          onSeedData={handleSeedData}
          onNewMeetingClick={() => {
            setSelectedMeetingId(null);
            setCurrentTab('new-meeting');
          }}
          onOpenSupabase={() => setSupabaseModalOpen(true)}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-8">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={loadPrimaryData}
                className="underline font-semibold ml-2 hover:text-rose-950"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading Action Item Tracker...</span>
              </div>
            </div>
          ) : selectedMeetingId && selectedMeetingData ? (
            <MeetingReviewView
              meeting={selectedMeetingData.meeting}
              decisions={selectedMeetingData.decisions}
              actionItems={selectedMeetingData.actionItems}
              auditLogs={selectedMeetingData.auditLogs}
              onBack={handleBackFromMeeting}
              onRefresh={async () => {
                await loadSelectedMeeting(selectedMeetingId);
                await loadPrimaryData();
              }}
            />
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardView
                  metrics={metrics}
                  meetings={meetings}
                  actionItems={actionItems}
                  onSelectMeeting={handleSelectMeeting}
                  onNewMeeting={() => setCurrentTab('new-meeting')}
                  onViewAllMeetings={() => setCurrentTab('meetings')}
                  onViewAllActionItems={() => setCurrentTab('action-items')}
                  onCompleteAction={handleCompleteAction}
                  onOpenSupabase={() => setSupabaseModalOpen(true)}
                />
              )}

              {currentTab === 'new-meeting' && (
                <NewMeetingView
                  onExtractionSuccess={handleExtractionSuccess}
                  onCancel={() => setCurrentTab('dashboard')}
                />
              )}

              {currentTab === 'meetings' && (
                <MeetingsListView
                  meetings={meetings}
                  onSelectMeeting={handleSelectMeeting}
                  onNewMeeting={() => setCurrentTab('new-meeting')}
                  onDeleteMeeting={handleDeleteMeeting}
                />
              )}

              {currentTab === 'action-items' && (
                <ActionItemsListView
                  actionItems={actionItems}
                  onRefresh={loadPrimaryData}
                  onSelectMeeting={handleSelectMeeting}
                />
              )}

              {currentTab === 'analytics' && (
                <AnalyticsView
                  metrics={metrics}
                  onRefreshMetrics={loadPrimaryData}
                />
              )}

              {currentTab === 'audit-log' && (
                <AuditLogView
                  logs={auditLogs}
                  onRefresh={loadPrimaryData}
                />
              )}

              {currentTab === 'settings' && (
                <SettingsView
                  settings={settings}
                  onRefreshSettings={loadPrimaryData}
                  onSeedData={handleSeedData}
                  onOpenSupabase={() => setSupabaseModalOpen(true)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Supabase Cloud Connection Modal */}
      <SupabaseModal
        isOpen={supabaseModalOpen}
        onClose={() => setSupabaseModalOpen(false)}
        onSynced={loadPrimaryData}
      />

      {/* Magical Multi-Color Rainbow Star Cursor Trail */}
      <RainbowStarCursor />
    </div>
  );
}
