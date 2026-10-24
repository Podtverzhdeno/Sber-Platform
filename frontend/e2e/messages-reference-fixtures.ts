/** Deterministic TEST-ONLY rendering fixtures transcribed from the three
 * approved Impulse Messenger mockups. These are never served to real users. */
const viewer="00000000-0000-0000-0000-000000000001";
const mentor="00000000-0000-4000-8000-000000000005";
const mayaki="00000000-0000-4000-8000-000000000103";
export const referenceIds = {mentor:"00000000-0000-4000-8000-000000000102",mayaki,team:"00000000-0000-4000-8000-000000000104"};
const participants=[
{id:mentor,display_name:"Елена Наставник",role:"member"},
{id:viewer,display_name:"Алекс Речной",role:"member"},
];
const members=[
{id:"member-anna",display_name:"Анна Ковалёва",role:"admin"},
{id:"member-ivan",display_name:"Иван Петров",role:"moderator"},
{id:"member-maria",display_name:"Мария Лебедева",role:"moderator"},
{id:"member-dmitry",display_name:"Дмитрий Соколов",role:"member"},
...participants,
];
const baseTime="2026-10-20T";
const msg=(id:string,author_id:string,author_name:string,body:string,time:string,artifact_refs:string[]=[])=>({
id,author_id,author_name,body,artifact_refs,
kind:"text",sequence:1,created_at:baseTime+time+":00Z"
});
const c=(id:string,kind:string,title:string,body:string,author_name:string,time:string,unread:number,participantsList=participants)=>({
id,kind,title,status:"active",task_id:kind==="task_team"?"task-01":null,
role:"member",muted:false,sender_enabled:true,unread,
participants:participantsList,last_message:msg("last-"+id,mentor,author_name,body,time),
created_at:"2026-10-20T08:00:00Z"
});
export const referenceChannels=[
c(mayaki,"community","Маяки","Друзья! Напоминаю о встречах…","Анна Ковалёва","12:59",4,members),
c("grant-competition","community","Грантовый конкурс","Коллеги, открыт приём заявок","Иван Петров","11:24",2,members),
c("school-21","community","Школа 21","Регистрация на новый поток","Мария Соколова","10:18",3,members),
c(referenceIds.mentor,"personal","Елена Наставник","Отлично! Тогда согласовываем этот вариант.","Елена Наставник","12:42",2),
c("roman-customer","personal","Роман Заказчик","Файл: ТЗ_финал.pdf","Роман Заказчик","11:28",1),
c("recommendation-prototype","task_team","Прототип рекомендателя","Вижу, спасибо! Двигаемся","Игорь","10:15",8),
c("ai-dev-community","community","AI в Dev Community","Доклад по новой статье","Евгений","08:14",24,members),
c("sberkot","community","СберКот","Собрал для вас новости","СберКот","08:09",12,members),
c("zlata","personal","Злата Вандервельд","Пересланное сообщение","Злата Вандервельд","08:01",0),
c("technology-news","community","Новости технологий","SmartWFM открывает портал","Редакция","07:49",6,members),
c("curator","personal","Алексей Куратор","Хорошо, жду результаты","Алексей Куратор","07:32",0),
c(referenceIds.team,"task_team","Команда задачи","Обновил статусы в задаче","Елена Наставник","07:26",0),
c("impulse-general","community","Импульс — Общий чат","Коллеги, завтра встреча","Анна","07:12",3,members),
];
export const referenceMessagesByChannel:Partial<Record<string,ReturnType<typeof msg>[]>>={
[mayaki]:[
msg("mayaki-1","member-anna","Анна Ковалёва","Друзья! Напоминаю, что на этой неделе стартует серия встреч «Карьера в IT: от обучения к возможностям».\n\nБудут спикеры из Яндекса, Сбера и Т-Банка. Подробности в прикреплённом посте 👇","09:24",["Программа_Карьера_в_IT.pdf"]),
msg("mayaki-2","member-dmitry","Дмитрий Соколов","Очень крутая инициатива! Уже зарегистрировался. Такие встречи реально помогают понять, куда двигаться дальше 🎯","10:03"),
msg("mayaki-3","member-maria","Мария Лебедева","Кстати, мы обновили подборку возможностей для студентов. Там стажировки, гранты и хакатоны.","11:17",["https://docs.google.com/document/d/example"]),
msg("mayaki-4","member-ivan","Иван Петров","Добавил в закреп календарь мероприятий. Если у вас есть предложения по новым активностям — пишите в этот чат или в форму обратной связи.","12:28"),
],
[referenceIds.mentor]:[
msg("mentor-1",mentor,"Елена Наставник","Привет! 👋\nЧерез час голосуем за приоритет эксперимента.\nПроверь, пожалуйста, финальные метрики и подготовь краткий комментарий по каждому варианту.","09:14"),
msg("mentor-2",viewer,"Алекс Речной","Привет! Уже смотрю данные. Вот обновлённая таблица с метриками по эксперименту.","09:28",["Метрики_эксперимента.xlsx"]),
msg("mentor-3",mentor,"Елена Наставник","Отлично, спасибо!\nМожешь также добавить пояснение по методологии расчёта? Это важно для презентации.","10:03"),
msg("mentor-4",viewer,"Алекс Речной","Конечно! Добавил отдельный лист с методологией и краткими выводами.","10:15",["Итоговая_методология.pdf"]),
msg("mentor-5",mentor,"Елена Наставник","Отлично! Тогда согласовываем этот вариант. Готовлю слайды и добавлю тебя в презентацию. 👍","12:42"),
]
};
