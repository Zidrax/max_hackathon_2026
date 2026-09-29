"use client";

import Script from "next/script";
import { FormEvent, useCallback, useContext, useEffect, useRef, useState } from "react";
import { FeedbackContext, Form, Icon, Modal } from "@/components/ui";
import { createActionRunner } from "@/lib/action";
import { api } from "@/lib/api";
import type {
  Appeal,
  AppealDetails,
  AppealStatus,
  Apartment,
  ApartmentAccessKey,
  ApartmentRange,
  CapitalRepair,
  CapitalRepairWork,
  Domik,
  LoginInput,
  Me,
  Notification,
  Poll,
} from "@/lib/types";

type Tab = "home" | "appeals" | "polls" | "notices" | "houses" | "repair";
type ActivityEvent = {
  id: string;
  date: string;
  kind: "appeal" | "poll" | "notice" | "work";
  title: string;
  text: string;
};
const statuses: Record<AppealStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Выполнена",
  rejected: "Отклонена",
};
const formatDate = (v?: string) =>
  v
    ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(
        new Date(v),
      )
    : "—";
const err = (e: unknown) =>
  e instanceof Error ? e.message : "Не удалось выполнить действие";
const compareApartmentNumbers = (left: Apartment, right: Apartment) => {
  const difference = Number(left.number) - Number(right.number);
  return Number.isFinite(difference)
    ? difference
    : left.number.localeCompare(right.number, "ru", { numeric: true });
};
const getResidentEvents = (
  appeals: Appeal[],
  polls: Poll[],
  notices: Notification[],
  works: CapitalRepairWork[],
) => {
  const events: ActivityEvent[] = [
    ...appeals.map((appeal) => ({
      id: `appeal-${appeal.id}`,
      date: appeal.updated_at || appeal.created_at,
      kind: "appeal" as const,
      title: "Заявка обновлена",
      text: `${appeal.title} · ${statuses[appeal.status]}`,
    })),
    ...polls.map((poll) => ({
      id: `poll-${poll.id}`,
      date: poll.created_at,
      kind: "poll" as const,
      title: "Новый опрос",
      text: poll.title,
    })),
    ...notices.map((notice) => ({
      id: `notice-${notice.id}`,
      date: notice.created_at,
      kind: "notice" as const,
      title: "Новое объявление",
      text: notice.title,
    })),
    ...works
      .filter((work) => work.completed_at)
      .map((work) => ({
        id: `work-${work.id}`,
        date: work.completed_at || "",
        kind: "work" as const,
        title: "Работа по капремонту выполнена",
        text: work.work_type,
      })),
  ];
  return events
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
    .slice(0, 10);
};

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [selectedAppeal, setSelectedAppeal] = useState<AppealDetails | null>(
    null,
  );
  const [polls, setPolls] = useState<Poll[]>([]);
  const [notices, setNotices] = useState<Notification[]>([]);
  const [houses, setHouses] = useState<Domik[]>([]);
  const [house, setHouse] = useState<Domik | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [repair, setRepair] = useState<CapitalRepair | null>(null);
  const [works, setWorks] = useState<CapitalRepairWork[]>([]);
  const [residentWorks, setResidentWorks] = useState<CapitalRepairWork[]>([]);
  const [modal, setModal] = useState<
    | "appeal"
    | "house"
    | "poll"
    | "notice"
    | "repair"
    | "work"
    | "apartment"
    | "access-code"
    | null
  >(null);
  const [accessKey, setAccessKey] = useState<ApartmentAccessKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [developerMode, setDeveloperMode] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [retryRefresh, setRetryRefresh] = useState(false);
  const [openingAppeal, setOpeningAppeal] = useState<string | null>(null);
  const runner = useRef(createActionRunner());
  const [confirmation, setConfirmation] = useState<{ title: string; text: string; run: () => Promise<unknown> } | null>(null);
  const openModal = (next: typeof modal) => {
    if (busy) return;
    setError(""); setSuccess(""); setModal(next);
  };
  const askDelete = (title: string, text: string, run: () => Promise<unknown>) => {
    if (busy) return;
    setError(""); setSuccess(""); setConfirmation({ title, text, run });
  };

  const refresh = useCallback(
    async (profile = me, silently = false, propagate = false) => {
      if (!profile) return;
      if (!silently) {
        setLoading(true);
        setError("");
      }
      try {
        if (profile.is_jk) {
          const [d, a, p, n] = await Promise.all([
            api.ukDomiks(),
            api.ukAppeals(),
            api.ukPolls(),
            api.ukNotifications(),
          ]);
          setHouses(d.domiks);
          setAppeals(a.appeals);
          setPolls(p.polls);
          setNotices(n.notifications);
        } else {
          const [a, p, n] = await Promise.all([
            api.appeals(),
            api.polls(),
            api.notifications(),
          ]);
          const domikIds = [...new Set(profile.apartments.map((apartment) => apartment.domik_id))];
          const repairs = await Promise.all(
            domikIds.map(async (domikId) => {
              try {
                return await api.capitalRepair(domikId);
              } catch {
                return null;
              }
            }),
          );
          setAppeals(a.appeals);
          setPolls(p.polls);
          setNotices(n.notifications);
          setResidentWorks(repairs.flatMap((repair) => repair?.works || []));
        }

        if (house) {
          if (profile.is_jk) {
            const repairResponse = await api.ukCapitalRepair(house.id);
            setRepair(repairResponse.capital_repair);
            if (repairResponse.capital_repair) {
              const worksResponse = await api.capitalRepairWorks(house.id);
              setWorks(worksResponse.works);
            } else {
              setWorks([]);
            }
          } else {
            const repairResponse = await api.capitalRepair(house.id);
            setRepair(repairResponse.capital_repair);
            setWorks(repairResponse.works || []);
          }
        }
      } catch (e) {
        if (propagate) throw e;
        if (!silently) setError(err(e));
      } finally {
        if (!silently) setLoading(false);
      }
    },
    [house, me],
  );
  async function login(input: LoginInput) {
    setLoading(true);
    setError("");
    try {
      await api.login(input);
      const profile = await api.me();
      setMe(profile);
      await refresh(profile);
    } catch (e) {
      setError(err(e));
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!me) return;
    const interval = window.setInterval(() => {
      void refresh(me, true);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [me, refresh]);
  useEffect(() => {
    if (modal || confirmation || selectedAppeal) return;
    window.WebApp?.BackButton?.hide();
  }, [modal, selectedAppeal, confirmation]);
  const action = async (fn: () => Promise<unknown>, afterSave?: () => void) => {
    if (busy) return false;
    setBusy(true); setError(""); setSuccess(""); setRetryRefresh(false);
    const result = await runner.current(fn, async () => {
      const profile = await api.me();
      setMe(profile);
      await refresh(profile, true, true);
    }, () => {
      window.WebApp?.HapticFeedback?.notificationOccurred("success");
      setModal(null);
      setConfirmation(null);
      setSuccess("Изменения сохранены");
      afterSave?.();
    });
    if (result.kind === "busy") return false;
    if (result.kind === "error") {
      setError(err(result.error));
      window.WebApp?.HapticFeedback?.notificationOccurred("error");
    } else if (result.kind === "refresh-error") {
      setSuccess(""); setError("Изменения сохранены, не удалось обновить данные"); setRetryRefresh(true);
    }
    setBusy(false);
    return result.kind === "success" || result.kind === "refresh-error";
  };
  const openAppeal = async (appeal: Appeal) => {
    if (openingAppeal) return;
    setOpeningAppeal(appeal.id); setError(""); setSuccess("");
    try {
      setSelectedAppeal(
        me?.is_jk ? await api.ukAppeal(appeal.id) : await api.appeal(appeal.id),
      );
    } catch (e) {
      setError(err(e));
    } finally { setOpeningAppeal(null); }
  };
  const selectHouse = async (h: Domik) => {
    setHouse(h);
    setApartments([]);
    setTab("houses");
    try {
      const [a, r] = await Promise.all([
        api.ukApartments(h.id),
        api.ukCapitalRepair(h.id),
      ]);
      setApartments(a.apartments);
      setRepair(r.capital_repair);
      if (r.capital_repair) {
        const w = await api.capitalRepairWorks(h.id);
        setWorks(w.works);
      } else {
        setWorks([]);
      }
    } catch (e) {
      setError(err(e));
    }
  };
  const residentRepair = async () => {
    const a = me?.apartments[0];
    if (!a) return;
    try {
      const r = await api.capitalRepair(a.domik_id);
      setRepair(r.capital_repair);
      setWorks(r.works || []);
      setHouse({ id: a.domik_id, address: a.domik_address || "Дом" });
      setTab("repair");
    } catch (e) {
      setError(err(e));
    }
  };

  if (!me)
    return (
      <>
        <Script
          src="https://st.max.ru/js/max-web-app.js"
          onLoad={() => {
            const user = window.WebApp?.initDataUnsafe?.user;
            if (user)
              void login({
                max_id: String(user.id),
                name: [user.first_name, user.last_name]
                  .filter(Boolean)
                  .join(" "),
              });
            else {
              setError("MAX не передал данные пользователя");
              setLoading(false);
            }
          }}
          onError={() => {
            setError("Не удалось загрузить MAX Bridge");
            setLoading(false);
          }}
        />
        <main className="shell">
          <section className="content">
            <div className="card empty">
              {developerMode ? (
                <DeveloperLogin busy={loading} login={login} />
              ) : (
                <>
                  {error || "Загружаем данные MAX…"}
                  {error && (
                    <div className="actions">
                      <button
                        className="btn secondary"
                        onClick={() => setDeveloperMode(true)}
                      >
                        Я разработчик
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </main>
      </>
    );
  const nav: { id: Tab; label: string }[] = me.is_jk
    ? [
        { id: "home", label: "Главная" },
        { id: "appeals", label: "Заявки" },
        { id: "houses", label: "Дома" },
        { id: "polls", label: "Опросы" },
        { id: "notices", label: "Объявления" },
      ]
    : [
        { id: "home", label: "Главная" },
        { id: "appeals", label: "Заявки" },
        { id: "polls", label: "Опросы" },
        { id: "notices", label: "Объявления" },
      ];
  return (
    <FeedbackContext.Provider value={{ busy, error, success }}>
    <main className="shell">
      <header className="top">
        <div className="top-row">
          <div>
            <div className="brand">Мой дом</div>
            {me.is_jk && (
              <div className="sub">
                УК — {me.management_org?.name || "не указана"}
              </div>
            )}
          </div>
          <span className="badge">{me.is_jk ? "УК" : "Житель"}</span>
        </div>
      </header>
      <section className="content">
        <div className="stack">
          {error && !modal && !confirmation && <div className="notice error" role="alert">{error}{retryRefresh && <button className="btn secondary small" disabled={busy} onClick={async () => {
            setBusy(true);
            try { const profile = await api.me(); setMe(profile); await refresh(profile, true, true); setError(""); setRetryRefresh(false); }
            catch { setError("Не удалось обновить данные. Попробуйте ещё раз."); }
            finally { setBusy(false); }
          }}>Повторить загрузку</button>}</div>}
          {success && <div className="notice success" role="status">{success}</div>}
          {openingAppeal && <div className="notice" role="status">Открываем заявку…</div>}
          {loading ? (
            <div className="card loading-card" role="status"><span className="loading-dot" aria-hidden="true" />Загружаем данные…</div>
          ) : (
            <>
              {tab === "home" && (
                <HomePanel
                  me={me}
                  houses={houses}
                  appeals={appeals}
                  events={getResidentEvents(appeals, polls, notices, residentWorks)}
                  openHouse={selectHouse}
                  openRepair={residentRepair}
                  addApartment={() => openModal("apartment")}
                  createAppeal={() => openModal(me.apartments.length ? "appeal" : "apartment")}
                  openEvent={(event) => {
                    if (event.kind === "appeal") {
                      const appeal = appeals.find(
                        (item) => item.id === event.id.replace("appeal-", ""),
                      );
                      if (appeal) void openAppeal(appeal);
                    } else if (event.kind === "work") {
                      void residentRepair().then(() => {
                        window.setTimeout(
                          () =>
                            document
                              .getElementById(event.id)
                              ?.scrollIntoView({ block: "center", behavior: "smooth" }),
                          0,
                        );
                      });
                    } else {
                      setTab(event.kind === "poll" ? "polls" : "notices");
                      window.setTimeout(
                        () =>
                          document
                            .getElementById(event.id)
                            ?.scrollIntoView({ block: "center", behavior: "smooth" }),
                        0,
                      );
                    }
                  }}
                />
              )}
              {tab === "appeals" && (
                <Appeals
                  me={me}
                  items={appeals}
                  add={() => openModal(me.apartments.length ? "appeal" : "apartment")}
                  open={openAppeal}
                />
              )}
              {tab === "polls" && (
                <Polls
                  me={me}
                  items={polls}
                  add={() => openModal("poll")}
                  vote={(id, c) => action(() => api.vote(id, c))}
                  close={(id) => action(() => api.closePoll(id))}
                  remove={(id) =>
                    askDelete("Удалить опрос?", `«${polls.find((p) => p.id === id)?.title || "Опрос"}» и результаты голосования будут удалены.`, () => api.deletePoll(id))
                  }
                />
              )}
              {tab === "notices" && (
                <Notices
                  me={me}
                  items={notices}
                  add={() => openModal("notice")}
                />
              )}
              {tab === "houses" && me.is_jk && (
                <Houses
                  houses={houses}
                  house={house}
                  apartments={apartments}
                  add={() => openModal("house")}
                  select={selectHouse}
                  openRepair={() => setTab("repair")}
                  addApartment={() => openModal("apartment")}
                  remove={(id) =>
                    askDelete("Удалить дом?", `${houses.find((h) => h.id === id)?.address || "Дом"} будет удалён вместе со всеми квартирами.`, () => api.deleteDomik(id))
                  }
                  removeApartment={(id) =>
                    house &&
                    askDelete("Удалить квартиру?", `Квартира ${apartments.find((a) => a.id === id)?.number || ""} будет удалена из дома.`, () => api.deleteUkApartment(house.id, id))
                  }
                  generateAccessKey={(id) =>
                    house &&
                    action(
                      async () => {
                        const key = await api.generateApartmentAccessKey(house.id, id);
                        setAccessKey(key);
                      },
                      () => setModal("access-code"),
                    )
                  }
                />
              )}
              {tab === "repair" && (
                <Repair
                  me={me}
                  house={house}
                  repair={repair}
                  works={works}
                  edit={() => openModal("repair")}
                  add={() => openModal("work")}
                  updateWorkStatus={(id, status) =>
                    house &&
                    action(() =>
                      api.updateCapitalRepairWork(house.id, id, { status }),
                    )
                  }
                  remove={(id) =>
                    house &&
                    askDelete("Удалить работу?", `«${works.find((w) => w.id === id)?.work_type || "Работа"}» будет удалена из списка капремонта.`, () => api.deleteCapitalRepairWork(house.id, id))
                  }
                />
              )}
            </>
          )}
        </div>
      </section>
      <nav className="nav" aria-label="Основные разделы">
        {nav.map((x) => (
          <button
            className={tab === x.id ? "active" : ""}
            aria-current={tab === x.id ? "page" : undefined}
            onClick={() => {
              setSuccess("");
              if (x.id === "repair") void residentRepair();
              else setTab(x.id);
            }}
            key={x.id}
          >
            <Icon name={x.id} />
            {x.label}
          </button>
        ))}
      </nav>
      {modal === "appeal" && (
        <AppealForm
          apartments={me.apartments}
          close={() => setModal(null)}
          save={(b) => action(() => api.createAppeal(b), () => { setTab("appeals"); setSuccess("Заявка отправлена. Её статус можно отслеживать здесь."); })}
        />
      )}
      {selectedAppeal && (
        <AppealScreen
          appeal={selectedAppeal}
          isUk={me.is_jk}
          close={() => setSelectedAppeal(null)}
          updateStatus={(status, text) => {
            return action(async () => {
              const updated = await api.updateAppealStatus(selectedAppeal.id, status, text);
              setSelectedAppeal((current) => current ? { ...current, ...updated, status, status_display: statuses[status] } : current);
            }).then(async (saved) => {
              if (!saved) return false;
              try { setSelectedAppeal(await api.ukAppeal(selectedAppeal.id)); }
              catch { setError("Статус сохранён, не удалось обновить историю. Откройте заявку повторно."); }
              return true;
            });
          }}
        />
      )}
      {modal === "house" && (
        <HouseForm
          close={() => setModal(null)}
          save={(b) => action(() => api.createDomik(b))}
        />
      )}
      {modal === "apartment" && (
        <ApartmentForm
          uk={me.is_jk}
          close={() => setModal(null)}
          save={(b) =>
            action(() =>
              me.is_jk && house
                ? api.createUkApartment(house.id, {
                    number: b.number || "",
                    entrance: b.entrance,
                  })
                : api.addApartment({
                    code: b.code || "",
                  }),
            )
          }
        />
      )}
      {modal === "access-code" && accessKey && (
        <AccessCode keyData={accessKey} close={() => setModal(null)} />
      )}
      {modal === "poll" && (
        <PollForm
          houses={houses}
          close={() => setModal(null)}
          save={(b) => action(() => api.createPoll(b))}
        />
      )}
      {modal === "notice" && (
        <NoticeForm
          houses={houses}
          close={() => setModal(null)}
          save={(b) => action(() => api.createNotification(b))}
        />
      )}
      {modal === "repair" && house && (
        <RepairForm
          repair={repair}
          close={() => setModal(null)}
          save={(b) =>
            action(() =>
              repair
                ? api.updateCapitalRepair(house.id, b)
                : api.createCapitalRepair(house.id, b),
            )
          }
        />
      )}
      {modal === "work" && house && (
        <WorkForm
          close={() => setModal(null)}
          save={(b) => action(() => api.createCapitalRepairWork(house.id, b))}
        />
      )}
      {confirmation && <Modal title={confirmation.title} close={() => setConfirmation(null)}>
        <p>{confirmation.text}</p>
        {error && <div className="notice error" role="alert">{error}</div>}
        <div className="actions"><button className="btn secondary" autoFocus disabled={busy} onClick={() => setConfirmation(null)}>Отмена</button><button className="btn danger" disabled={busy} onClick={() => void action(confirmation.run)}>{busy ? "Удаляем…" : "Удалить"}</button></div>
      </Modal>}
    </main>
    </FeedbackContext.Provider>
  );
}

function HomePanel({
  me,
  houses,
  appeals,
  events,
  openHouse,
  openRepair,
  addApartment,
  createAppeal,
  openEvent,
}: {
  me: Me;
  houses: Domik[];
  appeals: Appeal[];
  events: ActivityEvent[];
  openHouse: (h: Domik) => void;
  openRepair: () => void;
  addApartment: () => void;
  createAppeal: () => void;
  openEvent: (event: ActivityEvent) => void;
}) {
  return me.is_jk ? (
    <>
      {houses.map((h) => (
        <button
          className="card link-card"
          onClick={() => openHouse(h)}
          key={h.id}
        >
          <h3>{h.address}</h3>
          <span className="muted">Открыть управление домом →</span>
        </button>
      ))}
      {!houses.length && (
        <div className="card empty">Добавьте первый дом в разделе «Дома».</div>
      )}
    </>
  ) : (
    <>
      <div className="card">
        <h2>Здравствуйте, {me.name}</h2>
        <p className="muted">
          Заявок: {appeals.length}. Здесь можно связаться с УК и узнать о доме.
        </p>
        {!me.apartments.length && <p className="muted">Добавьте квартиру, чтобы отправить заявку в свою УК.</p>}
        <div className="actions"><button className="btn" onClick={createAppeal}>{me.apartments.length ? "Создать заявку" : "Добавить квартиру"}</button></div>
      </div>
      <section className="activity" aria-label="Последние события">
        <h2>Последние события</h2>
        {events.length ? (
          <div className="card activity-list">
            {events.map((event) => (
              <button
                className="activity-event"
                key={event.id}
                onClick={() => openEvent(event)}
              >
                <span className={`activity-event__icon ${event.kind}`}>
                  {event.kind === "appeal"
                    ? "✓"
                    : event.kind === "poll"
                      ? "☷"
                      : event.kind === "notice"
                        ? "!"
                        : "⌂"}
                </span>
                <div>
                  <b>{event.title}</b>
                  <p>{event.text}</p>
                  <span className="muted">{formatDate(event.date)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="card muted">Событий пока нет.</div>
        )}
      </section>
      {me.apartments.map((a) => (
        <div className="card" key={a.id}>
          <h3>Квартира {a.number}</h3>
          <p className="muted">
            {a.management_org?.name ? `УК — ${a.management_org.name}` : "УК не указана"}
          </p>
          <AddressDetails address={a.domik_address} />
          <button className="btn secondary small" onClick={openRepair}>
            Капремонт
          </button>
        </div>
      ))}
      <button className="btn secondary" onClick={addApartment}>
        + Добавить квартиру
      </button>
    </>
  );
}
function AddressDetails({ address }: { address?: string }) {
  if (!address) return null;
  return (
    <details className="details address-details">
      <summary>Показать адрес дома</summary>
      <p className="muted">{address}</p>
    </details>
  );
}
function Appeals({
  me,
  items,
  add,
  open,
}: {
  me: Me;
  items: Appeal[];
  add: () => void;
  open: (appeal: Appeal) => void;
}) {
  return (
    <>
      <div className="row between">
        <h2>{me.is_jk ? "Заявки домов" : "Мои заявки"}</h2>
        {!me.is_jk && (
          <button className="btn small" onClick={add}>
            {me.apartments.length ? "Создать заявку" : "Добавить квартиру"}
          </button>
        )}
      </div>
      {items.length ? (
        items.map((a) => (
          <button
            className="card link-card"
            key={a.id}
            onClick={() => open(a)}
          >
            <div className="row between">
              <h3>{a.title}</h3>
              <span className={"badge status-" + a.status}>
                {statuses[a.status]}
              </span>
            </div>
            <p className="muted">{formatDate(a.created_at)}</p>
            <p className="muted">{a.domik_address}{a.apartment_number ? ` · кв. ${a.apartment_number}` : ""}</p>
            {!me.is_jk && <p className="appeal-description appeal-preview">{a.description}</p>}
            <span className="muted">Открыть заявку →</span>
          </button>
        ))
      ) : (
        <div className="card empty"><h3>Заявок пока нет</h3><p>{me.is_jk ? "Здесь появятся обращения жителей ваших домов." : me.apartments.length ? "Сообщите о проблеме в доме — ответ УК появится в заявке." : "Сначала добавьте квартиру, чтобы направить обращение в свою УК."}</p>{!me.is_jk && <button className="btn" onClick={add}>{me.apartments.length ? "Создать заявку" : "Добавить квартиру"}</button>}</div>
      )}
    </>
  );
}
function AppealScreen({
  appeal,
  isUk,
  close,
  updateStatus,
}: {
  appeal: AppealDetails;
  isUk: boolean;
  close: () => void;
  updateStatus: (status: AppealStatus, text: string) => Promise<boolean>;
}) {
  const [status, setStatus] = useState<AppealStatus>(appeal.status);
  const [comment, setComment] = useState("");
  const { busy, error, success } = useContext(FeedbackContext);
  const [savedVersion, setSavedVersion] = useState(0);
  const history = appeal.history || appeal.appeal_history || [];
  const address = appeal.domik_address || appeal.domik?.address || "Дом";
  const apartmentNumber = appeal.apartment_number || appeal.apartment?.number;
  return (
    <Modal title="Заявка" close={close} guardChanges fullScreen savedVersion={savedVersion}>
      <div className="stack">
        {error && <div className="notice error" role="alert">{error}</div>}
        {success && <div className="notice success" role="status">{success}</div>}
        <div className="card">
          <div className="row between">
            <h2>{appeal.title}</h2>
            <span className={`badge status-${appeal.status}`}>
              {appeal.status_display || statuses[appeal.status]}
            </span>
          </div>
          <p className="muted">
            {isUk ? address : apartmentNumber ? `Кв. ${apartmentNumber}` : ""}
            {(isUk || apartmentNumber) && " · "}
            {formatDate(appeal.created_at)}
          </p>
          {!isUk && <AddressDetails address={address} />}
          {appeal.author && (
            <p className="muted">
              Автор: {appeal.author.name} {appeal.author.last_name}
            </p>
          )}
          <p className="appeal-description">{appeal.description}</p>
        </div>
        {isUk && (
          <div className="card">
            <h3>Обновить заявку</h3>
            <label className="field">
              Статус
              <select
                disabled={busy}
                value={status}
                onChange={(event) => setStatus(event.target.value as AppealStatus)}
              >
                {Object.entries(statuses).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Комментарий для жителя
              <textarea
                disabled={busy}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Например, мастер придёт завтра с 10:00 до 12:00"
              />
            </label>
            <div className="actions">
              <button className="btn" disabled={busy} onClick={async () => { if (await updateStatus(status, comment)) { setComment(""); setSavedVersion((v) => v + 1); } }}>
                {busy ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </div>
        )}
        {history.length ? (
          <div className="card">
            <h3>История заявки</h3>
            {history.map((entry, index) => (
              <div className="timeline" key={`${entry.changed_at}-${index}`}>
                <b>{entry.status_display || statuses[entry.status]}</b>
                <p className="muted">
                  {formatDate(entry.changed_at)}
                  {entry.changed_by
                    ? ` · ${typeof entry.changed_by === "string" ? entry.changed_by : entry.changed_by.name}`
                    : ""}
                </p>
                {entry.text && <p className="appeal-description">{entry.text}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="card muted">История изменений пока пуста.</div>
        )}
      </div>
    </Modal>
  );
}
function Polls({
  me,
  items,
  add,
  vote,
  close,
  remove,
}: {
  me: Me;
  items: Poll[];
  add: () => void;
  vote: (id: string, c: string) => void;
  close: (id: string) => void;
  remove: (id: string) => void;
}) {
  const { busy } = useContext(FeedbackContext);
  return (
    <>
      <div className="row between">
        <h2>Опросы</h2>
        {me.is_jk && (
          <button className="btn small" onClick={add}>
            + Опрос
          </button>
        )}
      </div>
      {items.length ? (
        items.map((p) => (
          <div className="card" id={`poll-${p.id}`} key={p.id}>
            <div className="row between">
              <h3>{p.title}</h3>
              <span className="badge">{p.is_active ? "Идёт" : "Закрыт"}</span>
            </div>
            <p className="muted">Голосов: {p.total_votes}</p>
            {!me.is_jk && <AddressDetails address={p.domik.address} />}
            {me.is_jk && <p className="muted">{p.domik.address}</p>}
            {p.description && <p>{p.description}</p>}
            <div className="poll-choices">
              {p.choices.map((c) =>
                me.is_jk ? (
                  <p className="row between" key={c.id}>
                    <span>{c.text}</span>
                    <span className="badge">{c.votes_count}</span>
                  </p>
                ) : (
                  <button
                    className={"btn " + (c.is_user_choice ? "" : "secondary")}
                    disabled={!p.is_active || busy}
                    aria-pressed={c.is_user_choice}
                    onClick={() => vote(p.id, c.id)}
                    key={c.id}
                  >
                    {c.text} · {c.votes_count}{c.is_user_choice ? " · Ваш выбор" : ""}
                  </button>
                ),
              )}
            </div>
            {me.is_jk && (
              <div className="actions">
                {p.is_active && (
                  <button
                    className="btn secondary small"
                    disabled={busy}
                    onClick={() => close(p.id)}
                  >
                    Закрыть
                  </button>
                )}
                <button
                  className="btn danger small"
                  disabled={busy}
                  onClick={() => remove(p.id)}
                >
                  Удалить
                </button>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="card empty"><h3>Опросов пока нет</h3><p>{me.is_jk ? "Создайте опрос, чтобы узнать мнение жителей." : "Когда УК опубликует опрос, вы сможете проголосовать здесь."}</p></div>
      )}
    </>
  );
}
function Notices({
  me,
  items,
  add,
}: {
  me: Me;
  items: Notification[];
  add: () => void;
}) {
  return (
    <>
      <div className="row between">
        <h2>Объявления</h2>
        {me.is_jk && (
          <button className="btn small" onClick={add}>
            + Объявление
          </button>
        )}
      </div>
      {items.length ? (
        items.map((n) => (
          <div className="card" id={`notice-${n.id}`} key={n.id}>
            <h3>{n.title}</h3>
            <p>{n.text}</p>
            <span className="muted">{formatDate(n.created_at)}</span>
            {!me.is_jk && (
              <AddressDetails address={n.domik?.address || n.domik_address} />
            )}
            {me.is_jk && (
              <p className="muted">{n.domik?.address || n.domik_address || "Дом"}</p>
            )}
          </div>
        ))
      ) : (
        <div className="card empty"><h3>Объявлений пока нет</h3><p>{me.is_jk ? "Опубликуйте важную информацию для жителей дома." : "Здесь появятся новости и сообщения от вашей УК."}</p></div>
      )}
    </>
  );
}
function Houses({
  houses,
  house,
  apartments,
  add,
  select,
  openRepair,
  addApartment,
  remove,
  removeApartment,
  generateAccessKey,
}: {
  houses: Domik[];
  house: Domik | null;
  apartments: Apartment[];
  add: () => void;
  select: (h: Domik) => void;
  openRepair: () => void;
  addApartment: () => void;
  remove: (id: string) => void;
  removeApartment: (id: string) => void;
  generateAccessKey: (id: string) => void;
}) {
  const sortedApartments = [...apartments].sort(compareApartmentNumbers);
  return (
    <>
      <div className="row between">
        <h2>Дома</h2>
        <button className="btn small" onClick={add}>
          + Дом
        </button>
      </div>
      {houses.map((h) => (
        <div className="house-item" key={h.id}>
          <button className="card link-card" onClick={() => select(h)}>
            <h3>{h.address}</h3>
            <span className="muted">Квартиры и капремонт →</span>
          </button>
          {house?.id === h.id && (
            <div className="card house-details">
              <details className="details">
                <summary>Квартиры ({sortedApartments.length})</summary>
                <div className="apartments-list">
                  <div className="actions">
                    <button className="btn small" onClick={addApartment}>
                      + Квартира
                    </button>
                  </div>
                  {sortedApartments.map((a) => (
                    <div className="row between" key={a.id}>
                      <span>
                        Кв. {a.number}
                        {a.entrance && ` · подъезд ${a.entrance}`}
                      </span>
                      <button
                        className="btn secondary small"
                        onClick={() => generateAccessKey(a.id)}
                      >
                        Код доступа
                      </button>
                      <button
                        className="btn danger small"
                        onClick={() => removeApartment(a.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              </details>
              <div className="actions">
                <button className="btn secondary small" onClick={openRepair}>
                  Капремонт
                </button>
                <button
                  className="btn danger small"
                  onClick={() => remove(h.id)}
                >
                  Удалить дом
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
function Repair({
  me,
  house,
  repair,
  works,
  edit,
  add,
  updateWorkStatus,
  remove,
}: {
  me: Me;
  house: Domik | null;
  repair: CapitalRepair | null;
  works: CapitalRepairWork[];
  edit: () => void;
  add: () => void;
  updateWorkStatus: (
    id: string,
    status: CapitalRepairWork["status"],
  ) => void;
  remove: (id: string) => void;
}) {
  const [workStatuses, setWorkStatuses] = useState<
    Record<string, CapitalRepairWork["status"]>
  >({});
  if (!house)
    return (
      <div className="card empty">
        Выберите дом, чтобы посмотреть капремонт.
      </div>
    );
  return (
    <>
      <div className="row between">
        <h2>Капремонт</h2>
        {me.is_jk && (
          <button className="btn small" onClick={edit}>
            {repair ? "Изменить" : "Создать счёт"}
          </button>
        )}
      </div>
      <div className="card">
        <h3>{me.is_jk ? house.address : "Капремонт дома"}</h3>
        {!me.is_jk && <AddressDetails address={house.address} />}
        {repair ? (
          <p>
            Тариф: <b>{repair.tariff_per_sqm} ₽/м²</b>
            <br />
            Собрано: {repair.collected_total} ₽ · Остаток: {repair.balance} ₽
          </p>
        ) : (
          <p className="muted">Счёт пока не опубликован.</p>
        )}
      </div>
      <div className="row between">
        <h3>Работы</h3>
        {me.is_jk && repair && (
          <button className="btn small" onClick={add}>
            + Работа
          </button>
        )}
      </div>
      {works.map((w) => (
        <div className="card" id={`work-${w.id}`} key={w.id}>
          <div className="row between">
            <h3>{w.work_type}</h3>
            <span className="badge">{w.status_display}</span>
          </div>
          <p className="muted">
            {w.planned_year} год · {w.cost || "стоимость не указана"} ₽
          </p>
          {w.description && <p>{w.description}</p>}
          {me.is_jk && (
            <div className="actions">
              <select
                aria-label={`Статус работы: ${w.work_type}`}
                className="work-status"
                value={workStatuses[w.id] || w.status}
                onChange={(event) =>
                  setWorkStatuses((current) => ({
                    ...current,
                    [w.id]: event.target.value as CapitalRepairWork["status"],
                  }))
                }
              >
                <option value="planned">Запланировано</option>
                <option value="in_progress">В работе</option>
                <option value="done">Выполнено</option>
              </select>
              <button
                className="btn secondary small"
                onClick={() => updateWorkStatus(w.id, workStatuses[w.id] || w.status)}
              >
                Сохранить статус
              </button>
              <button className="btn danger small" onClick={() => remove(w.id)}>
                Удалить
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
function DeveloperLogin({
  busy,
  login,
}: {
  busy: boolean;
  login: (input: LoginInput) => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const maxId = String(new FormData(event.currentTarget).get("max_id"));
    login({ max_id: maxId, name: "Разработчик" });
  };
  return (
    <form className="form" onSubmit={submit}>
      <p>Тестовый вход вне MAX</p>
      <label className="field">
        MAX ID
        <input required name="max_id" placeholder="ivan-123" autoComplete="off" />
      </label>
      <button className="btn" disabled={busy}>
        {busy ? "Входим…" : "Войти"}
      </button>
      <p className="muted">Только для локальной отладки.</p>
    </form>
  );
}
function AppealForm({
  apartments,
  close,
  save,
}: {
  apartments: Apartment[];
  close: () => void;
  save: (x: {
    apartment_id: string;
    title: string;
    description: string;
  }) => void;
}) {
  const f = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    if (!String(d.get("title") || "").trim() || !String(d.get("description") || "").trim() || !d.get("apartment")) return;
    save({
      apartment_id: String(d.get("apartment")),
      title: String(d.get("title")).trim(),
      description: String(d.get("description")).trim(),
    });
  };
  return (
    <Form title="Новая заявка" close={close}>
      <form className="form" onSubmit={f}>
        <label className="field">
          Квартира
          <select name="apartment" required>
            {apartments.map((a) => (
              <option value={a.id} key={a.id}>
                {a.domik_address}, кв. {a.number}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Тема
          <input name="title" required pattern=".*\S.*" placeholder="Например, не работает свет в подъезде" />
        </label>
        <label className="field">
          Описание
          <textarea name="description" required placeholder="Где возникла проблема, когда вы её заметили и что произошло" onChange={(e) => e.currentTarget.setCustomValidity(e.currentTarget.value.trim() ? "" : "Опишите проблему")} />
        </label>
        <button className="btn">Отправить</button>
      </form>
    </Form>
  );
}
function HouseForm({
  close,
  save,
}: {
  close: () => void;
  save: (x: {
    address: string;
    fias_id?: string;
    apartments: ApartmentRange[];
  }) => void;
}) {
  const [ranges, setRanges] = useState<
    { entrance: string; from: string; to: string }[]
  >([{ entrance: "1", from: "1", to: "" }]);
  const updateRange = (
    index: number,
    field: "entrance" | "from" | "to",
    value: string,
  ) => {
    setRanges((current) =>
      current.map((range, rangeIndex) =>
        rangeIndex === index ? { ...range, [field]: value } : range,
      ),
    );
  };
  const f = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    save({
      address: String(d.get("address")),
      fias_id: String(d.get("fias") || ""),
      apartments: ranges.map((range) => ({
        from: Number(range.from),
        to: Number(range.to),
        entrance: range.entrance,
      })),
    });
  };
  return (
    <Form title="Новый дом" close={close}>
      <form className="form" onSubmit={f}>
        <label className="field">
          Адрес
          <input name="address" required />
        </label>
        <label className="field">
          ФИАС ID
          <input name="fias" />
        </label>
        <div className="ranges">
          <b>Подъезды и квартиры</b>
          {ranges.map((range, index) => (
            <div className="range-card" key={index}>
              <div className="row between">
                <b>Подъезд {index + 1}</b>
                {ranges.length > 1 && (
                  <button
                    className="btn danger small"
                    type="button"
                    onClick={() =>
                      setRanges((current) =>
                        current.filter((_, rangeIndex) => rangeIndex !== index),
                      )
                    }
                  >
                    Удалить
                  </button>
                )}
              </div>
              <label className="field">
                Номер подъезда
                <input
                  value={range.entrance}
                  onChange={(event) => updateRange(index, "entrance", event.target.value)}
                  required
                  placeholder="1"
                />
              </label>
              <div className="range-card__numbers">
                <label className="field">
                  Квартиры с
                  <input
                    value={range.from}
                    onChange={(event) => updateRange(index, "from", event.target.value)}
                    type="number"
                    min="1"
                    required
                    placeholder="1"
                  />
                </label>
                <label className="field">
                  по
                  <input
                    value={range.to}
                    onChange={(event) => updateRange(index, "to", event.target.value)}
                    type="number"
                    min="1"
                    required
                    placeholder="100"
                  />
                </label>
              </div>
            </div>
          ))}
          <button
            className="btn secondary"
            type="button"
            onClick={() =>
              setRanges((current) => [
                ...current,
                { entrance: String(current.length + 1), from: "", to: "" },
              ])
            }
          >
            + Добавить подъезд
          </button>
        </div>
        <button className="btn">Создать</button>
      </form>
    </Form>
  );
}
function ApartmentForm({
  uk,
  close,
  save,
}: {
  uk: boolean;
  close: () => void;
  save: (x: { number?: string; entrance?: string; code?: string }) => void;
}) {
  const f = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    save({
      number: String(d.get("number") || ""),
      entrance: String(d.get("entrance") || ""),
      code: String(d.get("code") || "").trim(),
    });
  };
  return (
    <Form title={uk ? "Добавить квартиру" : "Привязать квартиру"} close={close}>
      <form className="form" onSubmit={f}>
        {!uk && (
          <label className="field">
            Одноразовый код от УК
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{10}"
              minLength={10}
              maxLength={10}
              required
              autoComplete="one-time-code"
              aria-describedby="access-code-help"
            />
            <span className="muted" id="access-code-help">
              УК выдаёт 10-значный код для конкретной квартиры.
            </span>
          </label>
        )}
        {uk && (
          <>
            <label className="field">
              Номер квартиры
              <input name="number" required />
            </label>
            <label className="field">
              Подъезд
              <input name="entrance" />
            </label>
          </>
        )}
        <button className="btn">{uk ? "Добавить" : "Привязать"}</button>
      </form>
    </Form>
  );
}
function AccessCode({
  keyData,
  close,
}: {
  keyData: ApartmentAccessKey;
  close: () => void;
}) {
  return (
    <Modal title="Код доступа" close={close}>
      <div className="stack">
        <p>
          Передайте жителю код для квартиры {keyData.apartment_number}. После
          успешной привязки он перестанет работать.
        </p>
        <output className="access-code" aria-label="Одноразовый код доступа">
          {keyData.code}
        </output>
        <button className="btn" onClick={close}>Готово</button>
      </div>
    </Modal>
  );
}
function PollForm({
  houses,
  close,
  save,
}: {
  houses: Domik[];
  close: () => void;
  save: (x: {
    domik_id: string;
    title: string;
    description: string;
    choices: string[];
  }) => void;
}) {
  const f = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    save({
      domik_id: String(d.get("house")),
      title: String(d.get("title")),
      description: String(d.get("description")),
      choices: String(d.get("choices"))
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    });
  };
  return (
    <Form title="Новый опрос" close={close}>
      <form className="form" onSubmit={f}>
        <label className="field">
          Дом
          <select name="house" required>
            {!houses.length && <option value="">Сначала добавьте дом в разделе «Дома»</option>}
            {houses.map((h) => (
              <option value={h.id} key={h.id}>
                {h.address}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Вопрос
          <input name="title" required />
        </label>
        <label className="field">
          Описание
          <textarea name="description" />
        </label>
        <label className="field">
          Варианты — каждый с новой строки
          <textarea name="choices" required />
        </label>
        <button className="btn" disabled={!houses.length}>Опубликовать</button>
      </form>
    </Form>
  );
}
function NoticeForm({
  houses,
  close,
  save,
}: {
  houses: Domik[];
  close: () => void;
  save: (x: { domik_id: string; title: string; text: string }) => void;
}) {
  const f = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    save({
      domik_id: String(d.get("house")),
      title: String(d.get("title")),
      text: String(d.get("text")),
    });
  };
  return (
    <Form title="Новое объявление" close={close}>
      <form className="form" onSubmit={f}>
        <label className="field">
          Дом
          <select name="house" required>
            {!houses.length && <option value="">Сначала добавьте дом в разделе «Дома»</option>}
            {houses.map((h) => (
              <option value={h.id} key={h.id}>
                {h.address}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Заголовок
          <input name="title" required />
        </label>
        <label className="field">
          Текст
          <textarea name="text" required />
        </label>
        <button className="btn" disabled={!houses.length}>Опубликовать</button>
      </form>
    </Form>
  );
}
function RepairForm({
  repair,
  close,
  save,
}: {
  repair: CapitalRepair | null;
  close: () => void;
  save: (x: {
    tariff_per_sqm: string;
    collected_total: string;
    spent_total: string;
  }) => void;
}) {
  const f = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    save({
      tariff_per_sqm: String(d.get("tariff")),
      collected_total: String(d.get("collected")),
      spent_total: String(d.get("spent")),
    });
  };
  return (
    <Form title="Счёт капремонта" close={close}>
      <form className="form" onSubmit={f}>
        <label className="field">
          Тариф ₽/м²
          <input name="tariff" required defaultValue={repair?.tariff_per_sqm} />
        </label>
        <label className="field">
          Собрано ₽
          <input name="collected" defaultValue={repair?.collected_total} />
        </label>
        <label className="field">
          Потрачено ₽<input name="spent" defaultValue={repair?.spent_total} />
        </label>
        <button className="btn">Сохранить</button>
      </form>
    </Form>
  );
}
function WorkForm({
  close,
  save,
}: {
  close: () => void;
  save: (x: Partial<CapitalRepairWork>) => void;
}) {
  const f = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    save({
      work_type: String(d.get("type")),
      planned_year: Number(d.get("year")),
      status: String(d.get("status")) as CapitalRepairWork["status"],
      cost: String(d.get("cost") || "") || null,
      contractor: String(d.get("contractor") || ""),
      description: String(d.get("description") || ""),
    });
  };
  return (
    <Form title="Работа по капремонту" close={close}>
      <form className="form" onSubmit={f}>
        <label className="field">
          Вид работ
          <input name="type" required />
        </label>
        <label className="field">
          Год
          <input
            type="number"
            name="year"
            required
            defaultValue={new Date().getFullYear()}
          />
        </label>
        <label className="field">
          Статус
          <select name="status">
            <option value="planned">Запланировано</option>
            <option value="in_progress">В работе</option>
            <option value="done">Выполнено</option>
          </select>
        </label>
        <label className="field">
          Стоимость ₽<input name="cost" />
        </label>
        <label className="field">
          Подрядчик
          <input name="contractor" />
        </label>
        <label className="field">
          Описание
          <textarea name="description" />
        </label>
        <button className="btn">Добавить</button>
      </form>
    </Form>
  );
}
