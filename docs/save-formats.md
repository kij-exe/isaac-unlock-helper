# Какие файлы загружать

Сайту нужен **один persistentgamedata-файл общего прогресса одного слота**. Файлы gamestate содержат текущий забег и не используются для тирлистов, статистики и графа открытий. Загружать их в пару к основному файлу не нужно.

| Редакция | Типичное имя в Steam Cloud для первого слота | Возможности сайта |
| --- | --- | --- |
| Repentance+ | `rep+persistentgamedata1.dat` | Тирлист, граф и статистика, включая онлайн-отметки |
| Repentance | `rep_persistentgamedata1.dat` | Тирлист, граф и статистика |
| Rebirth | `persistentgamedata1.dat` | Статистика Rebirth: 11 персонажей × 6 отметок, 20 испытаний |

Номер в конце — 1, 2 или 3. При выключенном Steam Cloud имя без префикса может использовать другая редакция. Поддерживаются копии с датой в начале имени без переименования. Редакция определяется заголовком **и всей схемой блоков**, а не именем файла. Если играете в Repentance+, старый Rebirth-файл не содержит вашего последующего прогресса дополнения.

В Windows папка Steam Cloud обычно `C:\Program Files (x86)\Steam\userdata\<SteamID>\250900\remote\`. Локальные файлы находятся в `%USERPROFILE%\Documents\My Games\Binding of Isaac Repentance+\`, `Binding of Isaac Repentance\` или `Binding of Isaac Rebirth\`. На главной странице есть пути для macOS и Linux / Steam Deck. Выбирайте актуальную папку своей редакции и свежую копию нужного слота по дате изменения. Пустой слот допустим; файл ещё не созданного слота может отсутствовать. Не выбирайте options.ini, log.txt, архив или папку. Об устройстве папок и резервных копиях: [FAQ автора IsaacScript](https://github.com/Zamiell/isaac-faq/blob/main/directories-and-save-files.md).

# Проверенные профили

| Заголовок | Секреты / счётчики | Блоков | Профиль |
| --- | --- | --- | --- |
| `ISAACNGSAVE06R` | 179 / 95 | 9 | Rebirth |
| `ISAACNGSAVE09R` | 638 / 496 | 11 | Repentance |
| `ISAACNGSAVE09R` | 642 / 523 | 11 | Repentance+ |

Неизвестная схема, Afterbirth / Afterbirth+ или старый вариант Repentance+ не принимаются молча за проверенную редакцию. Ошибка показывает обнаруженные размеры и поддержанные профили. Проверяются флаги, границы, размеры, структура и контрольная сумма. Повреждённая копия не заменяет уже загруженное сохранение; сообщение об ошибке остаётся над текущим экраном.

Repentance/Repentance+ используют KAGE checksum, а Rebirth — иной алгоритм: вращение 32-битной суммы по заголовкам блоков и их элементам, seed от счётчика загрузок и заключительный XOR. Алгоритмы независимо реализованы в JS и Python и дают одинаковый результат на пяти предоставленных persistentgamedata-файлах. Структура новых форматов описана в [REPENTOGON SaveFile.h](https://github.com/TeamREPENTOGON/REPENTOGON/blob/main/repentogon/SaveSyncing/SaveFile.h); алгоритм Rebirth сверен с [исходным кодом конвертера автора](https://github.com/akh5l/Binding-of-Isaac-Rebirth-Wii-U-to-PC-Save-File-Converter/blob/main/Checksum.cs).

# Отметки Repentance+

Сохраняются независимые биты: 1 — Normal offline, 2 — Hard offline, 4 — Normal online, 8 — Hard online. Суммы 3 и 15 допустимы. Значение 4 **не** считается Hard. В модели сохраняются rawValue, offline и online; итоговая отметка соответствует лучшему из двух записанных режимов. Источники: [описание автора Character Shenanigans](https://steamcommunity.com/workshop/filedetails/?id=3130836503), полученное официальным Steam GetPublishedFileDetails API, и [разделение битов в REPENTOGON](https://github.com/TeamREPENTOGON/REPENTOGON/blob/main/repentogon/Patches/CompletionTracker.cpp#L85). Это данные прохождения слота, не достижения Steam.

Дополнительные имена счётчиков 496–522 сверены с [актуальным enums_ex.lua REPENTOGON](https://github.com/TeamREPENTOGON/REPENTOGON/blob/main/repentogon/resources/scripts/enums_ex.lua). Неизвестный496 не получает придуманного значения. В статистике отдельно показаны онлайн-серии и записанные daily-серии.

Dead God для Repentance+ добавляет четыре условия638–641, без637. Они не доказываются флагами секретов и требуют ручной проверки, включая именно онлайн-daily, а не обычную daily-победу. Требование четырёх дополнительных условий указано в [Isaac Wiki](https://bindingofisaacrebirth.wiki.gg/wiki/Achievements); появление Item Descriptions подтверждено [официальными заметками патча1.9.7.13](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1810503566367174).

# Rebirth и отсутствие данных

Шесть отметок размещены шестью группами по11 персонажей в счётчиках26–91. Сопоставление сверено с [оригинальным Rebirth-парсером](https://github.com/ihabunek/isaac/blob/master/src/SaveGame.php) и [его справочником персонажей/целей](https://github.com/ihabunek/isaac/blob/master/src/Catalogue.php). Проверенные общие счётчики переводятся в общую модель; отсутствующие поздние показатели остаются null и отображаются «—». Фальшивые нулевые отметки за несуществующих в этой редакции персонажей не добавляются. Бестиария встреч/убийств/смертей у этого формата нет.

Тирлист и условия графа рассчитаны на Repentance/Repentance+ и к Rebirth не применяются. Rebirth открывается сразу на статистике с пояснением совместимости. Python CLI сохраняет именованный анализ Repentance; его `--raw` дополнительно разбирает проверенные Rebirth и Repentance+, включая их checksum. Сохранения не конвертируются и не записываются обратно.
