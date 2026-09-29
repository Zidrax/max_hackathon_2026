export type Id = string;
export type ManagementOrg = { id: Id; name: string; inn?: string };
export type LoginResponse = {
  status: string;
  id: Id;
  is_jk: boolean;
  management_org?: ManagementOrg | null;
};
export type Apartment = {
  id: Id;
  number: string;
  entrance?: string;
  domik_id: Id;
  domik_address?: string;
  management_org?: ManagementOrg | null;
  role?: string;
  role_display?: string;
  is_primary?: boolean;
};
export type ApartmentRange = {
  from: number;
  to: number;
  entrance?: string;
};
export type ApartmentAccessKey = {
  status: string;
  apartment_id: Id;
  apartment_number: string;
  purpose: "bind" | "unbind";
  code: string;
  created_at: string;
};
export type Me = {
  id: Id;
  max_id: string;
  name: string;
  last_name: string;
  is_jk: boolean;
  management_org: ManagementOrg | null;
  apartments: Apartment[];
};
export type Domik = {
  id: Id;
  address: string;
  fias_id?: string;
  apartments_count?: number;
  management_org?: ManagementOrg | null;
  created_at?: string;
};
export type AppealStatus = "new" | "in_progress" | "done" | "rejected";
export type Appeal = {
  id: Id;
  title: string;
  description: string;
  status: AppealStatus;
  created_at: string;
  updated_at?: string;
  apartment_id?: Id;
  apartment_number?: string;
  domik_id: Id;
  domik_address: string;
  management_org?: ManagementOrg | null;
  author?: { id: Id; name: string; last_name: string };
};
export type AppealHistory = {
  id?: Id;
  status: AppealStatus;
  status_display?: string;
  text: string;
  changed_at: string;
  changed_by?: { id: Id; name: string; last_name: string } | string | null;
};
export type AppealDetails = Appeal & {
  status_display?: string;
  domik?: { id: Id; address: string; management_org?: ManagementOrg | null };
  apartment?: { id: Id; number: string } | null;
  history?: AppealHistory[];
  appeal_history?: AppealHistory[];
};
export type PollChoice = {
  id: Id;
  text: string;
  order: number;
  votes_count: number;
  is_user_choice: boolean;
};
export type Poll = {
  id: Id;
  title: string;
  description: string;
  is_active: boolean;
  created_at: string;
  total_votes: number;
  choices: PollChoice[];
  user_voted?: boolean;
  user_choice_id?: Id | null;
  domik: { id: Id; address: string };
  author: { id: Id; name: string; last_name: string };
};
export type Notification = {
  id: Id;
  title: string;
  text: string;
  created_at: string;
  domik?: { id: Id; address: string };
  domik_id?: Id;
  domik_address?: string;
  created_by?: { id: Id; name: string; last_name: string } | null;
};
export type CapitalRepair = {
  id: Id;
  domik_id: Id;
  tariff_per_sqm: string;
  collected_total: string;
  spent_total: string;
  balance: string;
  updated_at: string;
};
export type CapitalRepairWork = {
  id: Id;
  work_type: string;
  planned_year: number;
  status: "planned" | "in_progress" | "done";
  status_display: string;
  cost: string | null;
  contractor: string;
  description: string;
  completed_at: string | null;
};
export type LoginInput = {
  max_id: string;
  name: string;
  is_jk?: boolean;
  management_org?: { name: string; inn: string };
};
