import type {
  Apartment,
  ApartmentAccessKey,
  ApartmentRange,
  Appeal,
  AppealDetails,
  AppealStatus,
  CapitalRepair,
  CapitalRepairWork,
  Domik,
  Id,
  LoginInput,
  LoginResponse,
  Me,
  Notification,
  Poll,
} from "@/lib/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}
type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      data?.status || "Не удалось выполнить запрос",
      response.status,
    );
  return data as T;
}

export const api = {
  login: (input: LoginInput) =>
    request<LoginResponse>("/login", { method: "POST", body: input }),
  me: () => request<Me>("/me"),
  apartments: () => request<{ apartments: Apartment[] }>("/user/apartments"),
  addApartment: (body: { code: string }) =>
    request<Apartment>("/user/apartments", { method: "POST", body }),
  appeals: () => request<{ appeals: Appeal[] }>("/user/appeals"),
  createAppeal: (body: {
    apartment_id: Id;
    title: string;
    description: string;
  }) => request<Appeal>("/user/appeals", { method: "POST", body }),
  appeal: (id: Id) => request<AppealDetails>(`/user/appeals/${id}`),
  polls: () => request<{ polls: Poll[] }>("/user/polls"),
  poll: (id: Id) => request<Poll>(`/user/polls/${id}`),
  vote: (id: Id, choice_id: Id) =>
    request<Poll>(`/user/polls/${id}/vote`, {
      method: "POST",
      body: { choice_id },
    }),
  pollResults: (id: Id) => request<Poll>(`/user/polls/${id}/results`),
  notifications: () =>
    request<{ notifications: Notification[] }>("/user/notifications"),
  notification: (id: Id) => request<Notification>(`/user/notifications/${id}`),
  capitalRepair: (id: Id) =>
    request<{
      capital_repair: CapitalRepair | null;
      works?: CapitalRepairWork[];
    }>(`/user/domik/${id}/capital-repair`),
  ukDomiks: () => request<{ domiks: Domik[] }>("/uk/domiks"),
  createDomik: (body: {
    address: string;
    fias_id?: string;
    apartments: ApartmentRange | ApartmentRange[];
  }) =>
    request<{ status: string; domik_id: Id; address: string; apartments_created: number }>(
      "/uk/domiks",
      { method: "POST", body },
    ),
  ukDomik: (id: Id) =>
    request<Domik & { apartments?: Apartment[] }>(`/uk/domiks/${id}`),
  deleteDomik: (id: Id) =>
    request<void>(`/uk/domiks/${id}`, { method: "DELETE" }),
  ukApartments: (domikId: Id) =>
    request<{ apartments: Apartment[] }>(`/uk/domiks/${domikId}/apartments`),
  createUkApartment: (
    domikId: Id,
    body: { number: string; entrance?: string },
  ) =>
    request<Apartment>(`/uk/domiks/${domikId}/apartments`, {
      method: "POST",
      body,
    }),
  ukApartment: (domikId: Id, id: Id) =>
    request<Apartment & { residents: Me[] }>(
      `/uk/domiks/${domikId}/apartments/${id}`,
    ),
  updateUkApartment: (
    domikId: Id,
    id: Id,
    body: { number?: string; entrance?: string },
  ) =>
    request<Apartment>(`/uk/domiks/${domikId}/apartments/${id}`, {
      method: "PATCH",
      body,
    }),
  deleteUkApartment: (domikId: Id, id: Id) =>
    request<void>(`/uk/domiks/${domikId}/apartments/${id}`, {
      method: "DELETE",
    }),
  generateApartmentAccessKey: (domikId: Id, apartmentId: Id) =>
    request<ApartmentAccessKey>(
      `/uk/domiks/${domikId}/apartments/${apartmentId}/generate-key`,
      { method: "POST", body: {} },
    ),
  ukAppeals: () => request<{ appeals: Appeal[] }>("/uk/appeals"),
  ukAppeal: (id: Id) => request<AppealDetails>(`/uk/appeals/${id}`),
  updateAppealStatus: (id: Id, status: AppealStatus, text?: string) =>
    request<Appeal>(`/uk/appeals/${id}/status`, {
      method: "POST",
      body: { status, text },
    }),
  ukPolls: () => request<{ polls: Poll[] }>("/uk/polls"),
  createPoll: (body: {
    domik_id: Id;
    title: string;
    description?: string;
    choices: string[];
  }) => request<Poll>("/uk/polls", { method: "POST", body }),
  closePoll: (id: Id) =>
    request<Poll>(`/uk/polls/${id}/close`, { method: "POST" }),
  deletePoll: (id: Id) =>
    request<void>(`/uk/polls/${id}`, { method: "DELETE" }),
  ukNotifications: () =>
    request<{ notifications: Notification[] }>("/uk/notifications"),
  createNotification: (body: { domik_id: Id; title: string; text: string }) =>
    request<Notification>("/uk/notifications", { method: "POST", body }),
  ukNotification: (id: Id) => request<Notification>(`/uk/notifications/${id}`),
  ukCapitalRepair: (id: Id) =>
    request<{ capital_repair: CapitalRepair | null }>(
      `/uk/domiks/${id}/capital-repair`,
    ),
  createCapitalRepair: (
    id: Id,
    body: {
      tariff_per_sqm: string;
      collected_total?: string;
      spent_total?: string;
    },
  ) =>
    request<CapitalRepair>(`/uk/domiks/${id}/capital-repair`, {
      method: "POST",
      body,
    }),
  updateCapitalRepair: (
    id: Id,
    body: {
      tariff_per_sqm?: string;
      collected_total?: string;
      spent_total?: string;
    },
  ) =>
    request<CapitalRepair>(`/uk/domiks/${id}/capital-repair`, {
      method: "PATCH",
      body,
    }),
  capitalRepairWorks: (id: Id) =>
    request<{ works: CapitalRepairWork[] }>(
      `/uk/domiks/${id}/capital-repair/works`,
    ),
  createCapitalRepairWork: (id: Id, body: Partial<CapitalRepairWork>) =>
    request<CapitalRepairWork>(`/uk/domiks/${id}/capital-repair/works`, {
      method: "POST",
      body,
    }),
  updateCapitalRepairWork: (
    domikId: Id,
    id: Id,
    body: Partial<CapitalRepairWork>,
  ) =>
    request<CapitalRepairWork>(
      `/uk/domiks/${domikId}/capital-repair/works/${id}`,
      { method: "PATCH", body },
    ),
  deleteCapitalRepairWork: (domikId: Id, id: Id) =>
    request<void>(`/uk/domiks/${domikId}/capital-repair/works/${id}`, {
      method: "DELETE",
    }),
};
