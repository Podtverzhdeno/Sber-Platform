import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { customerTaskPayload, submitCustomerBrief } from "./customer-task-api";
import type { CreateTaskBrief } from "./customer-create-task";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
const brief:CreateTaskBrief = {
  title:"Проверка семантического поиска",shortSummary:"Создать прототип поиска",
  skills:["Python","RAG"],department:"R&D",direction:"AI / ML",taskType:"MVP",
  problem:"Нужен воспроизводимый поиск",deliverable:"MVP и README",
  criteria:"• Прототип запускается\n• Метрика измерима",deadline:"2026-11-14",
  places:2,mode:"open",reward:"",dataTerms:"Только тестовые данные",
  ipTerms:"Права согласованы",support:"Еженедельный разбор",
};
const key="brief-00000000-0000-4000-8000-000000000000";
beforeEach(()=>{vi.resetAllMocks();sessionStorage.setItem("impulse_csrf","csrf-test");});
describe("customer task API publishing flow",()=>{
 it("converts wizard into complete server draft with evaluation rubric and readable criteria",()=>{
  const x=customerTaskPayload(brief,key);
  expect(x.acceptance_criteria).toEqual(["Прототип запускается","Метрика измерима"]);
  expect(x.case_rubric).toHaveProperty("reasoning");
  expect(x.compensation.paid).toBe(false);
  expect(x.mode).toBe("open");
  expect(x.problem).toContain("Еженедельный разбор");
 });
 it("creates exactly one task and sends it to moderation",async()=>{
  vi.mocked(apiRequest).mockImplementation(async(uri)=>{
   await Promise.resolve();
   if(uri==="/api/v1/customer/tasks")return [];
   if(uri==="/api/v1/customer/projects/demo-rd-lab/tasks")return {id:"task-uuid",project_key:"demo-rd-lab",task_key:key,status:"draft"};
   if(uri==="/api/v1/customer/tasks/task-uuid/submit")return {id:"task-uuid",project_key:"demo-rd-lab",task_key:key,status:"submitted"};
   throw new Error(uri);
  });
  const result=await submitCustomerBrief(brief,key);
  expect(result.status).toBe("submitted");
  expect(vi.mocked(apiRequest).mock.calls.filter(([uri])=>uri==="/api/v1/customer/projects/demo-rd-lab/tasks")).toHaveLength(1);
  expect(vi.mocked(apiRequest).mock.calls.some(([uri])=>uri.includes("/operations/tasks/"))).toBe(false);
 });
 it("recovers existing server task after a retry without duplicates",async()=>{
  vi.mocked(apiRequest).mockImplementation(async(uri)=>{
   await Promise.resolve();
   if(uri==="/api/v1/customer/tasks")return [{id:"existing",project_key:"demo-rd-lab",task_key:key,status:"draft"}];
   if(uri==="/api/v1/customer/tasks/existing/submit")return {id:"existing",project_key:"demo-rd-lab",task_key:key,status:"submitted"};
   throw new Error("Must not create another task");
  });
  expect((await submitCustomerBrief(brief,key)).id).toBe("existing");
  expect(vi.mocked(apiRequest).mock.calls.filter(([uri])=>uri.includes("/projects/"))).toHaveLength(0);
 });
 it("refuses an unsupported invitation flow instead of claiming it was sent",async()=>{
  await expect(submitCustomerBrief({...brief,mode:"invitation_only"},key)).rejects.toThrow("подтверждённых");
  expect(apiRequest).not.toHaveBeenCalled();
 });
});
