export interface Me { id: string; email: string; display_name: string | null; institution: string | null }
export interface Dashboard {
  counts: { subjects: number; batches: number; projects: number; teams: number; hackathons: number; needs_review: number };
  tree: { sid: string; sname: string; bid: string | null; bname: string | null; pid: string | null; pname: string | null; team_count: number }[];
  hackathons: { id: string; name: string; status: string; team_count: number }[];
  activity: Activity[];
}
export interface Activity { id: string; entity_type: string; action: string; after_data: Record<string, unknown> | null; created_at: string; entity_id?: string }
export interface Subject { id: string; name: string; course_code: string | null; description: string | null; batch_count: number; project_count: number }
export interface Batch { id: string; subject_id: string; subject_name: string; name: string; academic_year: string | null; project_count: number }
export interface Project { id: string; batch_id: string; batch_name: string; subject_name: string; subject_id: string; name: string; description: string | null; problem_statement: string | null; due_date: string | null; status: string; team_count: number }
export interface TeamRow { id: string; team_code: string; name: string; leader_name: string | null; review_status: string; member_count: number; project_names: string | null; hackathon_count: number }
export interface Member { id: string; full_name: string; roll_number: string | null; email: string | null; role: 'leader' | 'member' }
export interface TeamDetail { id: string; team_code: string; name: string; leader_name: string | null; problem_statement: string | null; description: string | null; repository_url: string | null; demo_url: string | null; review_status: string; professor_notes: string | null; created_at: string; updated_at: string;
  members: Member[]; projects: { id: string; name: string; batch_name: string; subject_name: string }[]; hackathons: { id: string; name: string; status: string }[]; submissions: { id: string; status: string; submitted_at: string | null; milestone_name: string }[] }
export interface Hackathon { id: string; name: string; organizer: string | null; description: string | null; registration_url: string | null; start_date: string | null; end_date: string | null; status: string; team_count: number }
export interface FormSource { id: string; label: string; purpose: string; form_url: string | null; sync_enabled: boolean; last_synced_at: string | null; project_name: string | null; hackathon_name: string | null; last_run: { status: string; rows_seen: number; created_count: number; updated_count: number; unchanged_count: number; error_count: number } | null }
