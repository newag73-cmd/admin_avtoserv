const ru={
  widget:{close:"Закрыть чат",typing:"Печатает…",bookingForm:"Форма записи",service:"Услуга",date:"Дата",time:"Время",chooseTime:"Выберите время",noSlots:"На эту дату свободных вариантов нет.",name:"Имя",phone:"Телефон",email:"Email для подтверждения",createBooking:"Создать запись",hideForm:"Скрыть форму",book:"Записаться",checkBooking:"Проверить запись",message:"Сообщение",send:"Отправить",startOver:"Начать заново",retry:"Повторить",counter:(n:number)=>`${n}/1000`,bookingStatus:"Проверить запись",bookingId:"Идентификатор из письма (необязательно)",checkStatus:"Проверить статус",adminTitle:"Администратор",ask:"Задать вопрос",greeting:"Здравствуйте! Чем могу помочь?",networkError:"Ошибка сети",emptyResponse:"Пустой ответ сервера",sendError:"Не удалось отправить сообщение"},
  admin:{loading:"Загрузка…",title:"Админ-панель",dashboard:"Обзор",bookings:"Записи",business:"Данные бизнеса",prompt:"Системный промпт",conversations:"Диалоги",leads:"Обращения",settings:"Настройки",test:"Тест диалога",save:"Сохранить",saveBusiness:"Сохранить данные",savePrompt:"Сохранить промпт",exportCsv:"Экспорт CSV",noContact:"—"}
} as const;
export type WidgetTextKey=keyof typeof ru.widget;
export type AdminTextKey=keyof typeof ru.admin;
export function widgetText(_locale:string){return ru.widget;}
export function adminText(_locale:string){return ru.admin;}
