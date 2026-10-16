-- ApartQN · 39 · quick replies seed (insert-only). Tokens: {{price_studio}} {{price_1br}} {{price_2br}}
insert into public.quick_replies (code, sort, title_vi, usage_vi, body_ru, body_en, body_vi, note_vi) values
('QR-01', 10, 'Hỏi nhu cầu', 'Ngay sau lời chào đầu tiên',
$q$Здравствуйте! Спасибо за интерес.
Все квартиры на apartqn.com полностью меблированы — можно заезжать сразу.
Аренда в месяц: студия — от {{price_studio}} VND, 1 спальня — от {{price_1br}} VND, 2 спальни — от {{price_2br}} VND.
Цена зависит от расположения дома, вида, мебели, срока аренды и наличия домашних животных.
Все варианты с ценами: apartqn.com/en
Чтобы подобрать квартиру, ответьте, пожалуйста:
1. Какой вариант вам подходит: студия / 1 спальня / 2 спальни?
2. С какой даты и на сколько месяцев?
3. Сколько человек, есть ли домашние животные?
4. Что для вас важнее всего: близость к морю, рабочее место, вид, тишина?$q$,
$q$Hello! Thanks for your interest.
All apartments on apartqn.com are fully furnished — you can move in right away.
Monthly rent: studio from {{price_studio}} VND, 1 bedroom from {{price_1br}} VND, 2 bedrooms from {{price_2br}} VND.
Price depends on building location, view, furnishing, lease term and pets.
All options with prices: apartqn.com/en
To find the right apartment, please tell me:
1. Which type suits you: studio / 1 bedroom / 2 bedrooms?
2. Move-in date and how many months?
3. How many people, any pets?
4. What matters most: near the sea, workspace, view, quiet?$q$,
$q$Xin chào! Cảm ơn bạn đã quan tâm.
Tất cả căn hộ trên apartqn.com đều đầy đủ nội thất, có thể dọn vào ở ngay.
Giá thuê/tháng: studio từ {{price_studio}} đ, 1 phòng ngủ từ {{price_1br}} đ, 2 phòng ngủ từ {{price_2br}} đ.
Giá thay đổi theo vị trí toà nhà, view, nội thất, thời gian thuê và thú cưng.
Xem tất cả căn kèm giá: apartqn.com
Để tìm căn phù hợp, bạn vui lòng cho biết:
1. Loại căn: studio / 1 phòng ngủ / 2 phòng ngủ?
2. Ngày vào ở và thuê bao nhiêu tháng?
3. Mấy người ở, có thú cưng không?
4. Điều gì quan trọng nhất: gần biển, chỗ làm việc, view, yên tĩnh?$q$,
'Không hỏi ngân sách mở. Giá "từ" lấy từ Cài đặt.'),

('QR-02', 20, 'Đang kiểm tra quỹ căn', 'Khách đã nêu nhu cầu, cần thời gian lọc căn',
$q$Отлично, спасибо! Подождите немного — проверю свободные квартиры под ваш бюджет и скоро напишу.$q$,
$q$Great, thank you! Please give me a moment — I'll check available apartments within your budget and get back to you shortly.$q$,
$q$Tuyệt, cảm ơn bạn! Bạn chờ mình chút nhé — mình kiểm tra căn trống trong ngân sách của bạn và báo lại ngay.$q$,
null),

('QR-03', 30, 'Gửi căn phù hợp', 'Đã lọc được căn khớp nhu cầu',
$q$Вот квартиры под ваш запрос:
1) [CODE] — [2] спальни, [13 500 000] VND/месяц — apartqn.com/en/[CODE]
2) [CODE] — [2] спальни, [15 000 000] VND/месяц — apartqn.com/en/[CODE]
Какие хотите посмотреть?$q$,
$q$Here are apartments that match your request:
1) [CODE] — [2] bedrooms, [13,500,000] VND/month — apartqn.com/en/[CODE]
2) [CODE] — [2] bedrooms, [15,000,000] VND/month — apartqn.com/en/[CODE]
Which ones would you like to view?$q$,
$q$Đây là các căn phù hợp với yêu cầu của bạn:
1) [CODE] — [2] phòng ngủ, [13.500.000] đ/tháng — apartqn.com/[CODE]
2) [CODE] — [2] phòng ngủ, [15.000.000] đ/tháng — apartqn.com/[CODE]
Bạn muốn xem căn nào?$q$,
'Giá viết đủ chữ số. Căn chưa có trên web → gửi ảnh trực tiếp.'),

('QR-04', 40, 'Hẹn xem nhà', 'Khách chọn được căn muốn xem',
$q$Можем показать [дата] в [время]. Вам удобно? Если нет — напишите удобное время.$q$,
$q$We can show it on [date] at [time]. Does that work? If not, tell me a time that suits you.$q$,
$q$Mình có thể dẫn bạn xem vào [ngày] lúc [giờ]. Bạn tiện không? Nếu không, bạn cho mình biết giờ phù hợp nhé.$q$,
'Kiểm tra chìa khoá / chủ nhà trước khi hẹn.'),

('QR-05', 50, 'Xác nhận lịch + điểm hẹn', 'Đã chốt giờ xem',
$q$Договорились: [дата], [время]. Адрес: [ссылка Google Maps]. Встречу вас у входа. Мой номер: +84 906 051 010.$q$,
$q$Confirmed: [date], [time]. Address: [Google Maps link]. I'll meet you at the entrance. My number: +84 906 051 010.$q$,
$q$Đã chốt: [ngày], [giờ]. Địa chỉ: [link Google Maps]. Mình đón bạn ở lối vào. Số của mình: 0906 051 010.$q$,
null),

('QR-06', 60, 'Chi phí ước tính', 'Khách hỏi tổng chi phí hằng tháng',
$q$Аренда: [цена] VND/месяц.
Дополнительные расходы (ориентировочно): электричество [..], вода [..], интернет [..], обслуживание [..].$q$,
$q$Rent: [price] VND/month.
Estimated additional costs: electricity [..], water [..], internet [..], management fee [..].$q$,
$q$Tiền thuê: [giá] đ/tháng.
Chi phí khác (ước tính): điện [..], nước [..], internet [..], phí quản lý [..].$q$,
'Chỉ điền số đã có thật. Luôn ghi "ước tính".'),

('QR-07', 70, 'Chưa biết câu trả lời', 'Câu hỏi về cọc, hợp đồng, wifi, giấy tờ...',
$q$Хороший вопрос — уточню у владельца и отвечу [сегодня / завтра].$q$,
$q$Good question — I'll check with the owner and get back to you [today / tomorrow].$q$,
$q$Câu hỏi hay — mình hỏi lại chủ nhà và trả lời bạn [hôm nay / ngày mai].$q$,
'Không tự trả lời pháp lý/cọc/hợp đồng — hỏi chủ nhà/chính sách thật.'),

('QR-08', 80, 'Nhắc lại (24 giờ)', 'Khách im lặng 24 giờ',
$q$Здравствуйте! Хотите посмотреть несколько вариантов квартир в центре Куиньона? Напишите, что вам подходит — студия, 1 или 2 спальни, — и я пришлю варианты.$q$,
$q$Hi! Would you like to see some apartment options in central Quy Nhon? Tell me what suits you — studio, 1 or 2 bedrooms — and I'll send options.$q$,
$q$Chào bạn! Bạn có muốn xem vài căn hộ ở trung tâm Quy Nhơn không? Cho mình biết bạn cần studio, 1 hay 2 phòng ngủ, mình gửi căn phù hợp nhé.$q$,
null),

('QR-09', 90, 'Tin cuối (3 ngày)', 'Khách vẫn im sau 3 ngày — gửi rồi dừng',
$q$Если поиск квартиры ещё актуален — пишите в любое время. Буду рад помочь.$q$,
$q$If you're still looking for an apartment, message me anytime. Happy to help.$q$,
$q$Nếu bạn vẫn đang tìm căn hộ, cứ nhắn mình bất cứ lúc nào nhé. Rất vui được giúp bạn.$q$,
null),

('QR-10', 100, 'Sau buổi xem nhà', 'Cùng ngày, sau khi xem',
$q$Спасибо, что пришли посмотреть! Какая квартира понравилась больше? Если есть вопросы — пишите.$q$,
$q$Thanks for coming to the viewing! Which apartment did you like most? Any questions, just ask.$q$,
$q$Cảm ơn bạn đã đến xem nhà! Bạn thích căn nào nhất? Có câu hỏi gì cứ nhắn mình nhé.$q$,
null),

('QR-11', 110, 'Chưa có căn phù hợp', 'Quỹ căn không khớp nhu cầu',
$q$Сейчас свободных квартир под ваш запрос нет. Как только появится подходящая — сразу напишу.$q$,
$q$Right now nothing available matches your request. I'll message you as soon as something suitable comes up.$q$,
$q$Hiện chưa có căn trống phù hợp yêu cầu của bạn. Có căn phù hợp là mình báo ngay.$q$,
'Ghi khách vào danh sách chờ (tiêu chí + ngân sách).'),

('QR-12', 120, 'Khách đòi giá thấp hơn mặt bằng', 'Khách hỏi kiểu "1PN giá 8 triệu có không?"',
$q$Спасибо за вопрос! За такую цену подходящих квартир у нас сейчас нет.
Все квартиры ApartQN полностью меблированы и готовы к проживанию, поэтому аренда в месяц: студия — от {{price_studio}} VND, 1 спальня — от {{price_1br}} VND, 2 спальни — от {{price_2br}} VND.
Могу предложить:
1. Вариант поменьше в вашем бюджете (например, студию вместо 1 спальни).
2. Список ожидания — если появится подходящая квартира, сразу напишу.
Что вам удобнее?$q$,
$q$Thanks for asking! Right now we don't have a suitable apartment at that price.
All ApartQN apartments are fully furnished and ready to live in, so monthly rents are: studio from {{price_studio}} VND, 1 bedroom from {{price_1br}} VND, 2 bedrooms from {{price_2br}} VND.
I can offer:
1. A smaller option within your budget (for example, a studio instead of 1 bedroom).
2. A waiting list — if a suitable apartment comes up, I'll message you right away.
Which works better for you?$q$,
$q$Cảm ơn bạn đã hỏi! Hiện chưa có căn phù hợp ở mức giá này.
Tất cả căn hộ ApartQN đều đầy đủ nội thất, sẵn sàng vào ở, nên giá thuê/tháng: studio từ {{price_studio}} đ, 1 phòng ngủ từ {{price_1br}} đ, 2 phòng ngủ từ {{price_2br}} đ.
Mình có thể đề xuất:
1. Căn nhỏ hơn trong ngân sách của bạn (ví dụ studio thay vì 1 phòng ngủ).
2. Danh sách chờ — có căn phù hợp mình báo ngay.
Bạn chọn cách nào?$q$,
'Không chê căn rẻ bên ngoài, không hứa giảm giá.')
on conflict (code) do nothing;
