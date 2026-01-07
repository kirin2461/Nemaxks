# RBAC & Moderation (Plan)

This document captures the agreed access model:
- Guild-scoped moderation (Discord-like)
- Global admin and super-admin
- No E2E for chats
- DM access requires super-admin approval
- Auditing with 45-day retention

## Roles
### Guild-scoped
- **Owner**: implicit highest authority within a guild (server)
- **Moderator**: assigned via guild UI; permissions apply only within that guild

### Global
- **Admin**: global judge; can moderate across all guilds; can respond to reports; can post announcements
- **Super admin**: all permissions; can override admin decisions, revoke permissions, and approve sensitive access

## Permissions model
Discord-like:
- `GuildRole` + `GuildMemberRole` assignments
- `ChannelPermission` allow/deny masks
- Special-case: guild owner overrides all deny within their guild

## Moderation actions
- Ban, mute, shadowban (guild scope for moderators, global for admins)
- Content filtering enforcement hooks
- Report review workflow

## DM access policy
- Default: **no** DM access for moderators and admins
- Admin can access DM only with a time-limited approval issued by super-admin ("sanction")
- Every DM access is audited

## Audit logging
Log all:
- Role changes
- Bans/mutes/shadowbans
- Message deletion
- Search/export
- DM access approvals and reads
- Site health/activity snapshots

Retention: 45 days.

## Export
Two modes:
- Direct download (CSV/JSON)
- Export to server storage (file + signed/authorized link)

## Implementation notes
This plan will be implemented in a dedicated PR series starting with RBAC guards and audit expansion.
