/**
 * Hand-maintained subset of the database schema. Once the project is live you can
 * regenerate this with `supabase gen types typescript` for full fidelity.
 */

export type UserRole = "admin" | "editor" | "viewer";
export type MetricSource =
  | "manual"
  | "admob_api"
  | "play_console"
  | "google_ads_api";

export interface Network {
  id: string;
  name: string;
  platform: string | null;
  active: boolean;
}

export interface App {
  id: string;
  network_id: string;
  name: string;
  package_name: string | null;
  active: boolean;
}

export interface DailyMetric {
  id: string;
  app_id: string;
  date: string;
  active_users: number | null;
  installs: number | null;
  uninstalls: number | null;
  gain_loss: number | null;
  admob_revenue: number;
  inapp_revenue: number;
  campaign_spend: number;
  net: number;
  source: MetricSource;
  entered_by: string | null;
  updated_at: string;
}

export type TwelveHourSlot = "first" | "second";

export interface TwelveHourReport {
  id: string;
  app_id: string;
  report_date: string;
  slot: TwelveHourSlot;
  cutoff_time: string;
  admob_revenue: number;
  google_ads_spend: number;
  net: number;
  entered_by: string | null;
  created_at: string;
}

export interface UserRoleRow {
  user_id: string;
  role: UserRole;
  network_scope: string[] | null;
  email?: string | null;
}

export interface Database {
  public: {
    Tables: {
      networks: {
        Row: Network;
        Insert: Partial<Network> & Pick<Network, "name">;
        Update: Partial<Network>;
      };
      apps: {
        Row: App;
        Insert: Partial<App> & Pick<App, "name" | "network_id">;
        Update: Partial<App>;
      };
      daily_metrics: {
        Row: DailyMetric;
        Insert: Omit<DailyMetric, "id" | "gain_loss" | "net" | "updated_at"> &
          Partial<Pick<DailyMetric, "id">>;
        Update: Partial<DailyMetric>;
      };
      twelve_hour_reports: {
        Row: TwelveHourReport;
        Insert: Omit<TwelveHourReport, "id" | "net" | "created_at"> &
          Partial<Pick<TwelveHourReport, "id">>;
        Update: Partial<TwelveHourReport>;
      };
      user_roles: {
        Row: UserRoleRow;
        Insert: UserRoleRow;
        Update: Partial<UserRoleRow>;
      };
    };
    Enums: {
      user_role: UserRole;
    };
  };
}
