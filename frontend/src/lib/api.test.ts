import { afterEach, describe, expect, it, vi } from "vitest";
import { api, request } from "./api";

describe("API client", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uses the proxy, JSON and session cookies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      request<{ status: string }>("/login", {
        method: "POST",
        body: { max_id: "ivan" },
      }),
    ).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ max_id: "ivan" }),
      }),
    );
  });
  it("turns an API status message into an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ status: "Квартира уже добавлена" }), {
            status: 409,
          }),
        ),
    );
    await expect(request("/user/apartments")).rejects.toMatchObject({
      message: "Квартира уже добавлена",
      status: 409,
    });
  });
  it("loads UK appeal details from the UK endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "appeal-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await api.ukAppeal("appeal-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/uk/appeals/appeal-1",
      expect.objectContaining({ credentials: "include" }),
    );
  });
  it("sends only a bind code when a resident adds an apartment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "apartment-1" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.addApartment({ code: "1234567890" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/user/apartments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "1234567890" }),
      }),
    );
  });
  it("generates an apartment access key from the UK endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "1234567890" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.generateApartmentAccessKey("house-1", "apartment-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/uk/domiks/house-1/apartments/apartment-1/generate-key",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
  });
});
