import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../api/client";
import { BuddyWorkspace } from "./buddy-workspace";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
const threadId = "33333333-3333-4333-8333-333333333333";
const response = {
  id:threadId,status:"active",content_deleted:false,messages:[
    {id:"user-1",client_message_id:"req-1",role:"user",content:"Привет!"},
    {id:"bot-1",client_message_id:"reply:req-1",role:"assistant",content:"Посмотри курс по API и проверь свою аналитику."},
  ],
};
const profile = { buddy_enabled:true,display_name:"Алекс" };
const bootcamp = { courses:[
  { course_key:"python-api",card:{title:"Разработка API на Python",course_key:"python-api",completion_state:"in_progress",access_state:"available"} },
] };
function view(){
  const client = new QueryClient({ defaultOptions:{queries:{retry:false}} });
  return render(<QueryClientProvider client={client}><BuddyWorkspace/></QueryClientProvider>);
}
beforeEach(()=>{vi.clearAllMocks();sessionStorage.setItem("impulse_csrf","csrf-test");});

describe("BuddyWorkspace",()=>{
 it("renders the approved single-chat layout without right context panel", async()=>{
  vi.mocked(apiRequest).mockImplementation(async path=>{
    await Promise.resolve();
    if(path==="/api/v1/me/profile")return profile;
    if(path==="/api/v1/agents/buddy/threads")return [];
    if(path==="/api/v1/me/bootcamp/overview")return bootcamp;
    throw Error(path);
  });
  view();
  expect(await screen.findByText(/Привет, я AI-Buddy/)).toBeVisible();
  expect(screen.getByRole("button",{name:/Новый диалог/})).toBeVisible();
  expect(screen.queryByText("На чём основан совет")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Сообщение AI-Buddy")).toBeVisible();
 });
 it("sends through API, shows saved reply with real course and markdown export", async()=>{
  vi.mocked(apiRequest).mockImplementation(async (path,options)=>{
    await Promise.resolve();
    if(path==="/api/v1/me/profile")return profile;
    if(path==="/api/v1/agents/buddy/threads" && options?.method==="POST")return {id:threadId,status:"active",messages:[],content_deleted:false};
    if(path==="/api/v1/agents/buddy/threads")return [];
    if(path==="/api/v1/me/bootcamp/overview")return bootcamp;
    if(path.endsWith("/reply") && path.includes(threadId))return response;
    if(path.endsWith(threadId))return response;
    return response;
  });
  view();
  const input=await screen.findByLabelText("Сообщение AI-Buddy");
  fireEvent.change(input,{target:{value:"Привет!"}});
  fireEvent.click(screen.getByRole("button",{name:"Отправить сообщение"}));
  await waitFor(()=>{expect(vi.mocked(apiRequest).mock.calls.some(([path])=>path.endsWith("/reply"))).toBe(true);});
  expect(await screen.findByText(/Посмотри курс по API/)).toBeVisible();
  expect(screen.getByText("Разработка API на Python")).toBeVisible();
  expect(screen.getByRole("button",{name:/Открыть курс/})).toBeVisible();
  expect(screen.getByText("Конспект рекомендаций")).toBeVisible();
 });
 it("shows model failure, preserves typed message and never invents a reply",async()=>{
  vi.mocked(apiRequest).mockImplementation(async(path,options)=>{
    await Promise.resolve();
    if(path==="/api/v1/me/profile")return profile;
    if(path==="/api/v1/me/bootcamp/overview")return bootcamp;
    if(path==="/api/v1/agents/buddy/threads" && options?.method==="POST")return {id:threadId,status:"active",messages:[],content_deleted:false};
    if(path==="/api/v1/agents/buddy/threads")return [];
    if(path.endsWith("/reply"))throw new Error("MODEL_UNAVAILABLE");
    return {id:threadId,status:"active",messages:[],content_deleted:false};
  });
  view();
  const input=await screen.findByLabelText("Сообщение AI-Buddy");
  fireEvent.change(input,{target:{value:"Сформируй план"}});
  fireEvent.click(screen.getByRole("button",{name:"Отправить сообщение"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("OpenRouter");
  expect(input).toHaveValue("Сформируй план");
  expect(screen.queryByText("Посмотри курс по API и проверь свою аналитику.")).not.toBeInTheDocument();
 });
 it("does not load threads or show the composer when profile opts out",async()=>{
  vi.mocked(apiRequest).mockImplementation(async path=>{
    await Promise.resolve();
    if(path==="/api/v1/me/profile")return {...profile,buddy_enabled:false};
    throw Error("No further API may be called");
  });
  view();
  expect(await screen.findByText("AI-Buddy выключен — модельные вызовы не выполняются")).toBeVisible();
  expect(screen.queryByLabelText("Сообщение AI-Buddy")).not.toBeInTheDocument();
 });
});
