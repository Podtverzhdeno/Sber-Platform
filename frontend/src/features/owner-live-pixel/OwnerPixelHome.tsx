import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { StatePanel } from "../../components/ui";
import { loadDevelopmentOverview, overviewQueryKey, type OpenTarget } from "../participant-home-v2/client";
import { PixelParticipantShell } from "../pixel-integration/PixelParticipantShell";

/**
 * The approved dark-blue dashboard is live on /workspace/0.
 * Server-side ACL and source IDs remain authoritative. The shared App
 * owns the only visible toolbar, search, notifications and account menu.
 */
export function OwnerPixelHome({displayName,navigation,buddyAvailable}:{
  displayName:string;
  navigation:readonly string[];
  buddyAvailable:boolean;
}) {
  const overview=useQuery({queryKey:overviewQueryKey,queryFn:loadDevelopmentOverview});
  const navigate=useNavigate();
  const goTo=(sections:readonly string[],query="")=>{
    const index=navigation.findIndex(name=>sections.includes(name));
    if(index>=0)void navigate(`/workspace/${String(index)}${query}`);
  };
  const onOpenTarget:OpenTarget=(kind,key,roleKey)=>{
    if(kind==="course"&&key){
      goTo(["Bootcamp"],`?course=${encodeURIComponent(key)}${roleKey?`&role=${encodeURIComponent(roleKey)}`:""}`);
    }else if(kind==="task"&&key){
      goTo(["Задачи","Мои задачи"],`?task=${encodeURIComponent(key)}`);
    }else{
      goTo(["Задачи","Мои задачи"]);
    }
  };
  const onOpenWorkspace=(destination?:string)=>{
    if(destination==="buddy"){
      goTo(["AI Buddy","AI-Buddy","AI-помощник"]);
    }else if(destination==="trajectory"){
      goTo(["Моя траектория","Мой путь"]);
    }else{
      goTo(["Портфолио","Мой путь","Моя траектория"]);
    }
  };
  if(overview.isPending)return <div className="owner-pixel-loading"><StatePanel kind="loading"/></div>;
  if(overview.isError){
    return <section className="owner-pixel-error" role="status">
      <h1 id="workspace-title">Не удалось загрузить обзор</h1>
      <p>Без данных профиля прогресс и навыки не отображаются.</p>
      <button type="button" onClick={()=>{void overview.refetch();}}>Повторить</button>
    </section>;
  }
  return <PixelParticipantShell
    embedded
    overview={overview.data}
    displayName={displayName}
    roleName="Участник"
    search=""
    searchResults={[]}
    onSearchChange={()=>undefined}
    onSearchSelect={()=>undefined}
    unreadNotifications={0}
    onOpenNotifications={()=>undefined}
    onOpenNavigation={()=>undefined}
    onOpenTarget={onOpenTarget}
    onOpenWorkspace={onOpenWorkspace}
    onOpenTools={()=>{goTo(["Портфолио","Мой путь","Моя траектория"]);}}
    buddyAvailable={buddyAvailable}
  />;
}
