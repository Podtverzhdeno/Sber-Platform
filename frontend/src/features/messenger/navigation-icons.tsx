import {
  BarChart3, BookMarked, BookOpenText, CheckSquare,
  Code2, Home, MessageCircleMore, Settings2, UsersRound,
} from "lucide-react";

const navIcons = {
  Главная: Home,
  Задачи: CheckSquare,
  Проекты: Code2,
  "Мои проекты": Code2,
  Курсы: BookMarked,
  Bootcamp: BookMarked,
  Сообщения: MessageCircleMore,
  Команда: UsersRound,
  "База знаний": BookOpenText,
  Аналитика: BarChart3,
  Настройки: Settings2,
} as const;

export function MessagesNavigationIcon({ section }: { section: string }) {
  const Icon = Object.hasOwn(navIcons, section)
    ? navIcons[section as keyof typeof navIcons]
    : BookOpenText;
  return <Icon size={19} strokeWidth={1.65} aria-hidden="true" />;
}
