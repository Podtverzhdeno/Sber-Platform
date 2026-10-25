/** Reference-specific teaching aids for the Data Security / Authorization unit.
 * Educational demonstration only; intentionally no stored credentials or hard-coded keys.
 */
export const authorizationMethods = [
  { title: "Парольная аутентификация", detail: "Пользователь подтверждает личность паролем. Сервер хранит только стойкий хэш, использует ограничение попыток и защиту восстановления доступа." },
  { title: "Двухфакторная аутентификация (2FA)", detail: "Второй независимый фактор: приложение-аутентификатор, ключ безопасности или иной подтверждённый способ." },
  { title: "Аутентификация по токену (JWT)", detail: "После входа клиент получает ограниченный по сроку подписанный токен; сервер проверяет подпись, срок действия и назначение." },
  { title: "Корпоративный вход (OAuth, SSO)", detail: "Федерация идентичности через проверенного провайдера с ограниченными scopes, audience и защитой перенаправлений." },
] as const;

export const authorizationWalkthrough = [
  { title: "Аутентификация пользователя", detail: "После проверки логина и второго фактора доверенный сервис формирует подписанный токен с идентификатором субъекта." },
  { title: "Выдача токена", detail: "В JWT задаются sub, exp, iss и aud. Ключ читается из защищённого окружения, а не из исходного кода." },
  { title: "Доступ к защищённому endpoint", detail: "Клиент передаёт Bearer-токен. Сервер проверяет подпись и claims до выполнения действия." },
  { title: "Проверка разрешений", detail: "Даже действительный JWT не даёт доступ к чужой заявке: объектные права проверяются отдельно." },
] as const;

export const authorizationRequirements = [
  { title: "Использовать FastAPI", detail: "Реализуйте защищённый endpoint и зависимости проверки пользователя" },
  { title: "Проверить JWT", detail: "Проверяйте подпись, issuer, audience, exp и допустимый алгоритм" },
  { title: "Вернуть профиль пользователя", detail: "Возвращайте только разрешённые поля, извлекая субъекта из проверенного токена" },
  { title: "Обработать ошибки доступа", detail: "Отдавайте 401 при невалидной аутентификации и 403 при недостаточных правах" },
] as const;

export const authorizationCriteria = [
  { title: "Работоспособность", detail: "Действительный токен для разрешённого пользователя открывает нужный ресурс" },
  { title: "Безопасность", detail: "Невалидный, просроченный или подменённый токен отклоняется" },
  { title: "Обработка ошибок", detail: "Сценарии 401 и 403 проверены автоматическими тестами" },
  { title: "Качество кода", detail: "Секреты не захардкожены, проверка оформлена переиспользуемой зависимостью" },
] as const;

export const authorizationExample = `# main.py — иллюстративный фрагмент: PyJWT + FastAPI
import os
import jwt
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import OAuth2PasswordBearer

app = FastAPI()
bearer = OAuth2PasswordBearer(tokenUrl="/token")
JWT_SECRET = os.environ["JWT_SECRET"]  # секрет хранится вне кода

def current_user(token: str = Depends(bearer)) -> dict:
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            audience="impulse-api",
            issuer="trusted-auth-service",
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"id": payload["sub"]}

@app.get("/me")
def my_profile(user: dict = Depends(current_user)):
    # Профиль ищется по проверенному sub, а не по ID из URL
    return {"id": user["id"]}

# Для чужих объектов дополнительно применяйте RBAC/ABAC
# и возвращайте 403 без раскрытия данных.
`;
