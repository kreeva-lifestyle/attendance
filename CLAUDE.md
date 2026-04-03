# AttendFlow — Attendance & Salary Management App

## Project Overview
A web application for managing employee attendance and salary calculations for Arya Designs (aryadesigns.co.in). The app is deployed at `attendance.aryadesigns.co.in` via GitHub Pages.

**Owner:** Manthan (non-technical business owner — always give clear, step-by-step instructions)

## Tech Stack
- **Frontend:** React (JSX), Tailwind CSS, Recharts, Lucide React, SheetJS (xlsx)
- **Backend:** Supabase (hosted Postgres + Auth + Realtime)
- **Deployment:** GitHub Pages via GitHub Actions (Vite build)
- **Repo:** `kreeva-lifestyle/attendance` on GitHub, `main` branch

## Supabase Project
- **Project Name:** Attendance
- **Project ID:** `hrgxygfwdtphxjzfapbe`
- **URL:** `https://hrgxygfwdtphxjzfapbe.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyZ3h5Z2Z3ZHRwaHhqemZhcGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzA1MTksImV4cCI6MjA5MDQ0NjUxOX0.rROlNXBGMhlAyKAPI0fC0uG12xW3Qjb1wP1CRe9GxKs`
- **Region:** Mumbai (ap-south-1)
- **Org ID:** `dqnfwiafjhtvtfktkdzp`
- **Other projects in org:** Unsort (`ulphprdnswznfztawbvg`), Pricedesk (`fcmesdnagvrdmjzzuwue`)

## Database Schema (all tables in `public` schema)

### profiles
- Extends Supabase auth.users
- Columns: id (UUID PK → auth.users), email, full_name, role ('super_admin'|'admin'|'viewer'), is_active, created_at, updated_at
- Auto-created via trigger `handle_new_user` on auth.users INSERT
- owner@aryadesigns.co.in → auto-assigned 'super_admin'

### att_employees
- Columns: id (UUID PK), employee_code (UNIQUE), name, email, phone, department, designation, date_of_joining, base_salary, status ('active'|'inactive'), created_by → profiles, created_at, updated_at
- Indexes: employee_code (unique), status, department, created_by

### att_attendance
- Columns: id (UUID PK), employee_id → att_employees, date, check_in (TIME), check_out (TIME), total_hours (GENERATED: checkout - checkin in hours), status ('present'|'absent'|'half_day'|'leave'|'holiday'), notes, created_at
- UNIQUE(employee_id, date)
- Indexes: (employee_id, date), date

### att_work_settings
- Per-month configuration
- Columns: id (UUID PK), month (1-12), year, total_working_days (default 26), work_hours_per_day (default 8), overtime_rate (default 1.5x), half_day_hours (default 4), created_at, updated_at
- UNIQUE(month, year)

### att_salary_records
- Columns: id (UUID PK), employee_id → att_employees, month, year, base_salary, days_present, days_absent, days_half_day, days_leave, total_hours_worked, overtime_hours, per_day_salary, earned_salary, overtime_pay, deductions, bonus, net_salary, status ('draft'|'calculated'|'approved'|'paid'), notes, calculated_by, approved_by, calculated_at, approved_at, created_at, updated_at
- UNIQUE(employee_id, month, year)
- Indexes: (month, year), employee_id

### att_notifications
- Columns: id (UUID PK), employee_id → att_employees, target_email, title, message, type ('salary_calculated'|'salary_approved'|'salary_paid'|'info'|'warning'), is_read, created_at
- Indexes: (target_email, is_read), employee_id

### att_import_logs
- Columns: id (UUID PK), import_type ('employees'|'attendance'), file_name, records_imported, records_failed, errors (JSONB), imported_by, created_at

## Row Level Security (RLS)
All tables have RLS enabled with these rules:
- **SELECT:** All authenticated users can view all data
- **INSERT/UPDATE:** Only 'super_admin' and 'admin' roles
- **DELETE:** Only 'super_admin' (admin and viewer CANNOT delete)
- Helper function: `get_user_role()` returns current user's role
- RLS uses `(SELECT auth.uid())` pattern for performance

## Realtime
Enabled on: att_employees, att_attendance, att_salary_records, att_notifications

## Auth
- Super Admin: owner@aryadesigns.co.in (Manthan) — pre-created in database
- Trigger auto-creates profile on signup; owner email gets super_admin, everyone else gets viewer
- Three roles: super_admin (full access + delete), admin (add/edit, no delete), viewer (read-only)

## Salary Calculation Logic
- per_day_salary = base_salary / total_working_days
- effective_days = days_present + (half_days × 0.5) + leave_days
- earned_salary = per_day_salary × effective_days
- overtime_hours = max(0, total_hours_worked - (effective_days × work_hours_per_day))
- overtime_pay = overtime_hours × (per_day_salary / work_hours_per_day) × overtime_rate
- net_salary = earned_salary + overtime_pay + bonus - deductions

## Excel Import Formats
### Employee Import
Columns: Employee Code, Name, Email, Phone, Department, Designation, Salary, Date of Joining

### Attendance Import
Columns: Employee Code, Date (YYYY-MM-DD), Check In (HH:MM), Check Out (HH:MM), Status (present/absent/half_day/leave)

## App Structure
Single-file React app: `src/App.jsx`
- Uses a lightweight custom Supabase client (no SDK — direct REST API calls)
- Pages: Dashboard, Employees, Attendance, Salary, Notifications, Settings
- Dark theme with cyan/blue accent colors, DM Sans font
- Mobile-responsive sidebar navigation

## Deployment
- GitHub Actions workflow at `.github/workflows/deploy.yml`
- Builds with Vite, deploys to GitHub Pages
- Custom domain: `attendance.aryadesigns.co.in` (CNAME in public/ folder)
- 404.html auto-generated for SPA routing

## Key Principles
- Manthan is non-technical: explanations must be clear, step-by-step, jargon-free
- All table names prefixed with `att_` (the Unsort project previously shared the same DB; now cleaned up, but prefix kept for clarity)
- Always use `(SELECT auth.uid())` wrapper in RLS for performance
- FK columns need explicit indexes
- Supabase project creation requires: get_cost → confirm_cost → create_project sequence
