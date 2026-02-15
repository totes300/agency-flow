# Phase 7: Polish & Cross-cutting

## What to Build

Notification system, mobile optimization pass, role-based permission audit, and keyboard shortcuts.

## Use Cases

### Notifications

**UC-7.1: In-App Notifications**
Bell icon in the header with an unread count badge. Clicking opens a list of recent notifications. Clicking a notification navigates to the relevant task and marks it read. "Mark all as read" action. Count stays live via realtime subscription. Notifications older than 90 days are auto-deleted via a Convex scheduled function.

**Notification triggers:**
- Task assigned to you
- @mentioned in a comment
- Task moves to Admin Review (notify admins)
- Admin approves or rejects your task
- Status changed on a task you're assigned to
- Retainer usage hits 80% of monthly allocation (notify admins)

### Mobile Optimization

**UC-7.3: Mobile Experience**
Systematic pass to ensure all views work well on phones. Mobile-critical features that must work perfectly: start/stop timer, view Today tasks, add time from list, mark tasks complete, view task detail.

Key adaptations: task list should use a compact layout (not a wide table), task creation via FAB, task detail goes full-screen, sidebar/metadata collapse appropriately, timer indicator is a sticky bottom bar, filters collapse into a drawer, drag-and-drop works on touch.

### Keyboard Shortcuts

**UC-7.4: Keyboard Shortcuts**
Global keyboard shortcuts accessible from anywhere in the app:
- `Cmd+K` / `Ctrl+K` — Open global search (built in Phase 1)
- `N` — Create new task (when not in a text input)
- `T` — Navigate to Today view
- Shortcuts should be discoverable via a `?` shortcut that opens a help overlay listing all shortcuts.

### Permission Audit

**UC-7.5: Permission Enforcement**
Review every Convex query and mutation to verify:
- Team members cannot access billing rates, profitability, or timesheet data
- Team members only see tasks assigned to them (not all tasks in their projects)
- Only admins can: manage clients/projects, manage work categories, set "Done" status, edit others' time entries, generate timesheets, approve/reject reviews

## Acceptance Criteria

- [ ] Notification bell shows live unread count
- [ ] All notification triggers fire correctly
- [ ] Clicking notification navigates to task and marks read
- [ ] All mobile-critical features work well on phone screens
- [ ] Touch drag-and-drop works in Today view
- [ ] No horizontal scroll on any view at mobile widths
- [ ] Keyboard shortcuts work (`Cmd+K`, `N`, `T`, `?` for help overlay)
- [ ] Every query/mutation enforces correct role-based access
