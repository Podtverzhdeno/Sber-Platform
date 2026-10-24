/* Read-only synthetic UI fixtures transcribed from Impulse_Messages_Код_и_Tasks.zip.
 * These illustrate the approved PNGs, never mutate messaging APIs or impersonate real participants.
 */
import type { ApiChannelView, ApiMessageView } from "./contracts";

const base = "2026-10-20T";
// The approved 01.png community timeline and the final message of 03.png are
// explicitly headed "Сегодня". Preserve that view independently of when the
// read-only demonstration is opened; older Elena messages stay on October 20.
const currentDate = new Date();
const todayBase =
  `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}T`;
type SpecRow = [string,string,string,string,string,number,"community"|"personal"|"task_team"];
const examples: SpecRow[] = [
  ["mayaki","Маяки","Анна Ковалёва","Друзья! Напоминаю о встречах и возможностях","12:59",4,"community"],
  ["grants","Грантовый конкурс","Иван Петров","Коллеги, открыт приём заявок","11:24",2,"community"],
  ["school21","Школа 21","Мария Соколова","Регистрация нового потока","10:18",3,"community"],
  ["mentor","Елена Наставник","Елена Наставник","Отлично! Тогда согласовываем этот вариант","12:42",2,"personal"],
  ["roman","Роман Заказчик","Роман Заказчик","Файл: ТЗ_финал.pdf","11:28",1,"personal"],
  ["proto","Прототип рекомендателя","Игорь","Вижу, спасибо! Двигаем дальше","10:15",8,"task_team"],
  ["aidev","AI in Dev Community","Евгений","Доклад по новой статье","09:05",24,"community"],
  ["sberkot","СберКот","СберКот","Собрал для вас новости","08:45",12,"task_team"],
  ["zlata","Злата Вандервельд","Злата Вандервельд","Пересланное сообщение","08:15",0,"personal"],
  ["news","Новости технологий","Новости технологий","Открывает портал","08:00",6,"task_team"],
  ["curator","Алексей Куратор","Алексей Куратор","Хорошо, жду результаты","07:56",0,"personal"],
  ["taskteam","Команда задачи","Команда задачи","Обновил статусы в задаче","07:30",0,"task_team"],
  ["common","Импульс — Общий чат","Анна","Коллеги, завтра встреча","07:15",3,"task_team"]
];
const id=(x:string)=>"reference:"+x;
export const isReferenceChannel=(x:string|undefined|null)=>Boolean(x?.startsWith("reference:"));
const me={id:id("me"),display_name:"Алекс Речной",role:"member"};
export const referenceChannels:ApiChannelView[]=examples.map(([key,title,peer,preview,stamp,unread,kind])=>({
 id:id(key),kind,title,status:"preview",task_id:null,role:"viewer",muted:false,sender_enabled:false,unread,
 created_at:base+"07:00:00+03:00",
 participants:[me,{id:id(key+"-peer"),display_name:peer,role:"member"}],
 last_message:{id:id(key+"-last"),author_id:id(key+"-peer"),author_name:peer,kind:"text",body:preview,artifact_refs:[],sequence:1,created_at:base+stamp+":00+03:00"}
}));
const msg=(key:string,n:number,name:string,clock:string,body:string,artifact_refs:string[]=[],useToday=false):ApiMessageView=>({
 id:id(`${key}-message-${String(n)}`),author_id:name==="Алекс Речной"?id("me"):id(name),author_name:name,kind:"text",body,artifact_refs,sequence:n,created_at:(useToday?todayBase:base)+clock+":00+03:00"
});
export const referenceMessages:Record<string,ApiMessageView[]>={
 [id("mentor")]:[
  msg("mentor",1,"Елена Наставник","09:14","Привет! 👋\nЧерез час голосуем за приоритет эксперимента.\nПроверь, пожалуйста, финальные метрики и подготовь краткий комментарий по каждому варианту."),
  msg("mentor",2,"Алекс Речной","09:28","Привет! Уже смотрю данные. Вот обновлённая таблица с метриками по эксперименту.",["Метрики_эксперимента.xlsx"]),
  msg("mentor",3,"Елена Наставник","10:03","Отлично, спасибо!\nМожешь также добавить пояснение по методологии расчёта? Это важно для презентации."),
  msg("mentor",4,"Алекс Речной","10:15","Конечно! Добавил отдельный лист с методологией и краткими выводами.",["Итоговая_методология.pdf"]),
  msg("mentor",5,"Елена Наставник","12:42","Отлично! Тогда согласовываем этот вариант. Готовлю слайды и добавлю тебя в презентацию. 👍",[],true)
 ],
 [id("mayaki")]:[
  msg("mayaki",1,"Анна Ковалёва","09:24","Друзья! Напоминаю, что на этой неделе стартует серия встреч «Карьера в IT: от обучения к возможностям».\nБудут спикеры из Яндекса, Сбера и Т-Банка.",["Программа_Карьера_в_IT.pdf"],true),
  msg("mayaki",2,"Дмитрий Соколов","10:03","Очень крутая инициатива! Уже зарегистрировался. Такие встречи реально помогают понять, куда двигаться дальше 🎯",[],true),
  msg("mayaki",3,"Мария Лебедева","11:17","Кстати, мы обновили подборку возможностей для студентов. Там стажировки, гранты и хакатоны.",["Возможности для студентов — октябрь 2026"],true),
  msg("mayaki",4,"Иван Петров","12:28","Добавил в закреп календарь мероприятий. Если у вас есть предложения по новым активностям — пишите в этот чат.",[],true)
 ]
};
export const referencePinnedMessage="Календарь мероприятий на осень 2026 — возможности, стажировки, митапы";
export const referenceDescriptions:Record<string,string>={
 [id("mentor")]:"Наставник по продуктовой аналитике. Помогает с методологией, экспериментами и карьерным развитием.",
 [id("mayaki")]:"Сообщество студентов, которые развиваются, создают проекты и находят возможности вместе. Маяки — это люди, идеи и движение вперёд."
};

/** Context file list from approved app.js, preview-only: these are labels, not downloads. */
export const referenceSharedFiles:Record<string,string[]> = {
  [id("mentor")]:["Метрики_эксперимента.xlsx","Итоговая_методология.pdf","Презентация_эксперимента.pptx"],
  [id("mayaki")]:["Программа_Карьера_в_IT.pdf","Гайд_Стажировки_2026.pdf","Презентация_Маяки.pptx"],
};
