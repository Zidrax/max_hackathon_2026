"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";

export const FeedbackContext = createContext({ busy: false, error: "", success: "" });

export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "m3 10 9-7 9 7v10H3V10 M9 20v-7h6v7",
    appeals: "M5 3h14v18H5V3 M8 8h8 M8 12h8 M8 16h5",
    houses: "M4 21V3h16v18 M8 7h1 M15 7h1 M8 11h1 M15 11h1 M10 21v-6h4v6",
    polls: "M5 20V10h3v10 M11 20V4h3v16 M17 20v-7h3v7",
    notices: "m4 10 14-6v16L4 14v-4 M7 15v5h3v-4 M21 9v6",
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.home} /></svg>;
}

export function Modal({ title, close, children, guardChanges = false, fullScreen = false, savedVersion = 0 }: {
  title: string; close: () => void; children: React.ReactNode; guardChanges?: boolean; fullScreen?: boolean; savedVersion?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const dirty = useRef(false);
  useEffect(() => { dirty.current = false; }, [savedVersion]);
  const [discard, setDiscard] = useState(false);
  const { busy } = useContext(FeedbackContext);
  const latest = useRef({ close, busy, discard });
  useEffect(() => { latest.current = { close, busy, discard }; });
  const requestClose = () => {
    if (latest.current.busy) return;
    if (latest.current.discard) { setDiscard(false); return; }
    if (guardChanges && dirty.current) setDiscard(true);
    else latest.current.close();
  };
  const closeRef = useRef(requestClose);
  useEffect(() => { closeRef.current = requestClose; });
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    const back = () => closeRef.current();
    window.WebApp?.BackButton?.show();
    window.WebApp?.BackButton?.onClick(back);
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      window.WebApp?.BackButton?.offClick(back);
      window.WebApp?.BackButton?.hide();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={ref} className={`dialog${fullScreen ? " dialog-screen" : ""}`} aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); requestClose(); }} onChangeCapture={() => { dirty.current = true; }}>
    <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="btn secondary small" disabled={busy} onClick={requestClose}>Закрыть</button></div>
    {discard ? <div className="stack"><h3>Закрыть без сохранения?</h3><p>Введённые данные будут потеряны.</p><div className="actions"><button className="btn" autoFocus onClick={() => setDiscard(false)}>Продолжить заполнение</button><button className="btn danger" onClick={close}>Не сохранять</button></div></div> : null}
    <div hidden={discard}>{children}</div>
  </dialog>;
}

export function Form({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const { busy, error } = useContext(FeedbackContext);
  return <Modal title={title} close={close} guardChanges>
    {error && <div className="notice error" role="alert">{error}</div>}
    {busy && <p className="muted" role="status">{title === "Новая заявка" ? "Отправляем…" : "Сохраняем…"}</p>}
    <fieldset className="form-fields" disabled={busy} aria-busy={busy}>{children}</fieldset>
  </Modal>;
}
