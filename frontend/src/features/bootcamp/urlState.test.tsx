import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, useLocation, useSearchParams } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import {
  BOOTCAMP_URL_DEFAULTS,
  bootcampUrlSearch,
  extendBootcampUrlState,
  parseBootcampSearch,
  parseBootcampUrl,
  serializeBootcampUrl,
} from "./urlState";

afterEach(() => {
  window.history.replaceState({}, "", "/");
  document.body.textContent = "";
});

describe("bootcamp v2 url state", () => {
  it("parses v2 params and keeps defaults for missing or invalid values", () => {
    const explicit = parseBootcampSearch("?view=list&relevance=user&track=python&category=ml&q=  повтор  &level=starter&course=ml-served");
    expect(explicit).toEqual({
      view: "list",
      relevance: "user",
      track: "python",
      category: "ml",
      q: "повтор",
      level: "starter",
      course: "ml-served",
    });
    const empty = parseBootcampSearch("");
    expect(empty).toEqual(BOOTCAMP_URL_DEFAULTS);
    const invalid = parseBootcampSearch("?view=grid&relevance=&track=%20&q=&category=&course=   ");
    expect(invalid).toEqual({
      ...BOOTCAMP_URL_DEFAULTS,
      relevance: "all",
      track: "all",
    });
  });

  it("parses legacy v1 deep links unchanged when only course is present", () => {
    expect(parseBootcampSearch("?course=python-base")).toEqual({
      ...BOOTCAMP_URL_DEFAULTS,
      course: "python-base",
    });
  });

  it("round-trips a full state through serialize → parse with stable ties", () => {
    const full = {
      view: "list" as const,
      relevance: "catalog",
      track: "data",
      category: "analytic",
      q: "sql sink",
      level: "advanced",
      course: null,
    };
    const params = serializeBootcampUrl(full);
    expect(params.get("relevance")).toBe("catalog");
    expect(params.get("q")).toBe("sql sink");
    expect(parseBootcampUrl(new URLSearchParams(params.toString()))).toEqual(full);
    const defaults = bootcampUrlSearch(BOOTCAMP_URL_DEFAULTS);
    expect(defaults).toBe("");
    const listOnly = bootcampUrlSearch({ ...BOOTCAMP_URL_DEFAULTS, view: "list" });
    expect(listOnly).toBe("?view=list");
  });

  it("keeps the course anchor by default and drops it when explicitly nulled", () => {
    const deep = { ...BOOTCAMP_URL_DEFAULTS, course: "python-base" };
    expect(extendBootcampUrlState(deep, { view: "list" }).course).toBe("python-base");
    expect(extendBootcampUrlState(deep, { course: null }).course).toBeNull();
  });

  it("reacts to browser popstate with parseable search", async () => {
    function Probe() {
      const [searchParams] = useSearchParams();
      const location = useLocation();
      const state = parseBootcampUrl(searchParams);
      return (
        <>
          <div data-testid="bootcamp-location">{location.search}</div>
          <div data-testid="bootcamp-state">
            {state.view}
            {state.course === null ? "" : `|${state.course}`}
            {state.level === null ? "" : `|${state.level}`}
          </div>
        </>
      );
    }
    window.history.replaceState({}, "", "/workspace/2?course=python-base");
    render(
      <BrowserRouter>
        <Probe />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("bootcamp-location").textContent).toBe("?course=python-base");
    expect(screen.getByTestId("bootcamp-state").textContent).toBe("card|python-base");
    window.history.pushState({}, "", "/workspace/2?course=python-base&level=starter");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => {
      expect(screen.getByTestId("bootcamp-location").textContent).toBe(
        "?course=python-base&level=starter",
      );
    });
    expect(screen.getByTestId("bootcamp-state").textContent).toBe("card|python-base|starter");
    window.history.back();
    fireEvent(window, new PopStateEvent("popstate"));
    await waitFor(() => {
      expect(screen.getByTestId("bootcamp-location").textContent).toBe("?course=python-base");
    });
    expect(screen.getByTestId("bootcamp-state").textContent).toBe("card|python-base");
  });
});
