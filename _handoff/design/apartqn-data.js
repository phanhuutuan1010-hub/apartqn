/* ApartQN — DEMO DATA + i18n (vi default, en, ru). Loaded by every DC via <helmet>. */
(function () {
  const LOCS = ['vi', 'en', 'ru'];
  const TAG = { vi: 'vi-VN', en: 'en-US', ru: 'ru-RU' };
  const ix = (l) => Math.max(0, LOCS.indexOf(l));
  const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };

  const B = [
    { id: 'altara', x: 58, y: 34, name: 'Altara Residences Quy Nhơn', street: 'Trần Hưng Đạo', am: ['pool', 'gym', 'security', 'lift', 'basement', 'mart'] },
    { id: 'phutai', x: 30, y: 52, name: 'Phú Tài Residence', street: 'Lý Thái Tổ', am: ['security', 'lift', 'basement', 'mart', 'kids'] },
    { id: 'flc', x: 74, y: 58, name: 'FLC Sea Tower Quy Nhơn', street: 'An Dương Vương', am: ['pool', 'gym', 'security', 'lift', 'basement', 'mart'] },
    { id: 'tms', x: 64, y: 44, name: 'TMS Luxury Hotel & Residences Quy Nhơn', street: 'Nguyễn Huệ', am: ['pool', 'gym', 'security', 'lift', 'basement'] },
    { id: 'hagl', x: 22, y: 30, name: 'HAGL Quy Nhơn', street: 'Đầm sinh thái Đống Đa', am: ['pool', 'security', 'lift', 'basement', 'mart', 'kids'] },
    { id: 'apt', x: 16, y: 70, name: 'An Phú Thịnh Garden Tower', street: 'KĐT An Phú Thịnh', am: ['security', 'lift', 'mart', 'kids'] },
    { id: 'thinhphat', x: 46, y: 62, name: 'Thịnh Phát Tower', street: 'Thanh Niên', am: ['pool', 'security', 'lift', 'basement'] },
    { id: 'ecolife', x: 38, y: 20, name: 'Ecolife Riverside', street: 'Điện Biên Phủ', am: ['pool', 'gym', 'security', 'lift', 'mart', 'kids'] }
  ];

  const base = { deposit: 2, cycle: 'm1', elec: 'evn', water: 'meter', minTerm: 6, tempReg: true, verified: true, video: false, status: 'available' };
  const L = [
    { code: 'QN-001', b: 'altara', floor: 18, area: 68, beds: 2, baths: 2, dir: 'SE', view: 'sea', furn: 'full', rent: 13500000, mgmt: 816000, moto: 150000, car: 1500000, net: 220000, maxOcc: 4, pets: false, moveIn: '2026-10-05', updated: '2026-09-21', photos: 12, video: true },
    { code: 'QN-002', b: 'flc', floor: 25, area: 45, beds: 1, baths: 1, dir: 'E', view: 'sea', furn: 'full', rent: 9000000, deposit: 1, cycle: 'm3', mgmt: 540000, elec: 'fixed', water: 'person', moto: 120000, car: 1200000, net: 0, maxOcc: 2, pets: true, moveIn: '2026-09-28', updated: '2026-09-22', photos: 9 },
    { code: 'QN-003', b: 'tms', floor: 30, area: 85, beds: 2, baths: 2, dir: 'S', view: 'sea', furn: 'full', rent: 18000000, mgmt: 1190000, moto: 150000, car: 1800000, net: 250000, minTerm: 12, maxOcc: 4, pets: false, moveIn: '2026-11-01', updated: '2026-09-19', photos: 14, video: true, status: 'reserved' },
    { code: 'QN-004', b: 'phutai', floor: 9, area: 72, beds: 2, baths: 2, dir: 'NE', view: 'city', furn: 'basic', rent: 8500000, deposit: 1, mgmt: 504000, moto: 100000, car: 1000000, net: 200000, maxOcc: 4, pets: true, moveIn: '2026-10-01', updated: '2026-09-15', photos: 7, tempReg: false, verified: false },
    { code: 'QN-005', b: 'hagl', floor: 14, area: 98, beds: 3, baths: 2, dir: 'W', view: 'lagoon', furn: 'basic', rent: 11000000, cycle: 'm3', mgmt: 686000, moto: 100000, car: 1000000, net: 200000, maxOcc: 6, pets: true, moveIn: '2026-10-10', updated: '2026-09-20', photos: 10, video: true },
    { code: 'QN-006', b: 'ecolife', floor: 8, area: 64, beds: 2, baths: 2, dir: 'E', view: 'river', furn: 'full', rent: 8000000, mgmt: 448000, moto: 100000, car: 900000, net: 200000, maxOcc: 4, pets: false, moveIn: '2026-10-15', updated: '2026-09-18', photos: 8 },
    { code: 'QN-007', b: 'apt', floor: 11, area: 60, beds: 2, baths: 1, dir: 'N', view: 'city', furn: 'empty', rent: 6500000, deposit: 1, mgmt: 360000, moto: 80000, car: 800000, net: 180000, maxOcc: 4, pets: true, moveIn: '2026-10-01', updated: '2026-09-12', photos: 6, verified: false },
    { code: 'QN-008', b: 'thinhphat', floor: 16, area: 55, beds: 1, baths: 1, dir: 'SE', view: 'sea', furn: 'full', rent: 10000000, mgmt: 440000, moto: 120000, car: 1200000, net: 220000, maxOcc: 2, pets: false, moveIn: '2027-03-01', updated: '2026-09-10', photos: 9, status: 'rented' },
    { code: 'QN-009', b: 'altara', floor: 22, area: 52, beds: 1, baths: 1, dir: 'E', view: 'sea', furn: 'full', rent: 11000000, mgmt: 624000, moto: 150000, car: 1500000, net: 220000, maxOcc: 2, pets: false, moveIn: '2026-10-20', updated: '2026-09-23', photos: 11, video: true }
  ].map((l) => Object.assign({}, base, l));

  // [vi, en, ru]
  const T = {
    tagline: ['Căn hộ cho thuê · Quy Nhơn', 'Apartments for rent · Quy Nhon', 'Аренда квартир · Куинён'],
    demo: ['DỮ LIỆU DEMO', 'DEMO DATA', 'ДЕМО-ДАННЫЕ'],
    navApts: ['Căn hộ', 'Apartments', 'Квартиры'],
    navBlds: ['Toà nhà', 'Buildings', 'Здания'],
    navConsign: ['Ký gửi căn hộ', 'List your apartment', 'Сдать квартиру'],
    navContact: ['Liên hệ', 'Contact', 'Контакты'],
    heroEyebrow: ['Thuê dài hạn · tối thiểu 6 tháng', 'Long-term · 6 months minimum', 'Долгосрочно · от 6 месяцев'],
    heroTitle: ['Căn hộ thuê dài\u00A0hạn tại trung\u00A0tâm Quy\u00A0Nhơn', 'Long-term apartments in central Quy\u00A0Nhon', 'Долгосрочная аренда в\u00A0центре Куинёна'],
    heroSub: ['Căn hộ đã xác minh, chi phí hằng tháng minh bạch. Hỗ trợ tiếng Việt, tiếng Anh và tiếng Nga.', 'Verified apartments with transparent monthly costs. Support in Vietnamese, English and Russian.', 'Проверенные квартиры и прозрачные ежемесячные расходы. Поддержка на вьетнамском, английском и русском.'],
    sBuilding: ['Toà nhà / khu vực', 'Building / area', 'Жилой комплекс / район'],
    sAnyBuilding: ['Tất cả toà nhà', 'All buildings', 'Все комплексы'],
    sRent: ['Giá thuê / tháng', 'Rent / month', 'Аренда в месяц'],
    sAny: ['Bất kỳ', 'Any', 'Любая'],
    sBeds: ['Phòng ngủ', 'Bedrooms', 'Спальни'],
    sFurn: ['Nội thất', 'Furniture', 'Мебель'],
    search: ['Tìm căn hộ', 'Search', 'Найти'],
    filters: ['Bộ lọc', 'Filters', 'Фильтры'],
    pets: ['Cho nuôi thú cưng', 'Pets allowed', 'Можно с животными'],
    carPark: ['Có chỗ đậu ô tô', 'Car parking', 'Парковка для автомобиля'],
    moveIn: ['Ngày dọn vào', 'Move-in date', 'Дата заезда'],
    reset: ['Đặt lại', 'Reset', 'Сбросить'],
    close: ['Đóng', 'Close', 'Закрыть'],
    rent0: ['Dưới 8 triệu', 'Under 8M ₫', 'до 8 млн ₫'], rent1: ['8–12 triệu', '8–12M ₫', '8–12 млн ₫'], rent2: ['12–18 triệu', '12–18M ₫', '12–18 млн ₫'], rent3: ['Trên 18 triệu', 'Over 18M ₫', 'от 18 млн ₫'],
    furn_full: ['Đầy đủ', 'Fully furnished', 'Полностью меблирована'], furn_basic: ['Cơ bản', 'Basic', 'Частично'], furn_empty: ['Không nội thất', 'Unfurnished', 'Без мебели'],
    st_available: ['Còn trống', 'Available', 'Свободна'], st_reserved: ['Đã đặt cọc', 'Reserved', 'Забронирована'], st_rented: ['Đã cho thuê', 'Rented', 'Сдана'],
    verified: ['Đã xác minh', 'Verified', 'Проверено'],
    perMonth: ['/tháng', '/mo', '/мес.'],
    estMonthly: ['Ước tính chi phí/tháng', 'Est. monthly cost', 'Расходы в месяц ≈'],
    moveInFrom: ['Dọn vào từ', 'Move in from', 'Заезд с'],
    featured: ['Căn hộ nổi bật', 'Featured apartments', 'Избранные квартиры'],
    seeAll: ['Xem tất cả', 'See all', 'Смотреть все'],
    bldTitle: ['Toà nhà ở trung tâm', 'Buildings in the centre', 'Жилые комплексы в центре'],
    bldSub: ['8 toà nhà trong khu trung tâm Quy Nhơn — chúng tôi không nhận căn ngoài khu vực này.', '8 buildings in central Quy Nhon — we don’t list anything outside the centre.', '8 комплексов в центре Куинёна — объекты за пределами центра мы не размещаем.'],
    from: ['từ', 'from', 'от'],
    whyTitle: ['Vì sao chọn ApartQN', 'Why ApartQN', 'Почему ApartQN'],
    why1t: ['Chỉ trung tâm Quy Nhơn', 'Central Quy Nhon only', 'Только центр Куинёна'],
    why1d: ['Chúng tôi chỉ làm việc với các toà nhà trung tâm và biết rõ từng toà, từng ban quản lý.', 'We only work with central buildings and know each one and its management well.', 'Работаем только с домами в центре и хорошо знаем каждый дом и его управляющую компанию.'],
    why2t: ['Căn hộ đã xác minh', 'Verified listings', 'Проверенные объявления'],
    why2d: ['Căn có huy hiệu xác minh đã được kiểm tra tận nơi: ảnh thật, giá thật, tình trạng cập nhật.', 'Verified units are checked in person: real photos, real price, current status.', 'Квартиры с отметкой проверены на месте: реальные фото, реальная цена, актуальный статус.'],
    why3t: ['Chi phí minh bạch', 'Transparent costs', 'Прозрачные расходы'],
    why3d: ['Phí quản lý, gửi xe, internet và cách tính điện nước hiển thị rõ trước khi bạn đi xem.', 'Management, parking, internet and utility billing are shown up front, before you view.', 'Обслуживание, парковка, интернет и порядок оплаты коммунальных услуг — до просмотра.'],
    consignTitle: ['Bạn có căn hộ cho thuê?', 'Own an apartment in Quy Nhon?', 'Сдаёте квартиру в Куинёне?'],
    consignSub: ['Ký gửi miễn phí. Chúng tôi chụp ảnh, xác minh và tìm khách thuê dài hạn.', 'List it for free. We photograph, verify and find long-term tenants.', 'Разместите бесплатно. Мы сделаем фото, проверим квартиру и найдём долгосрочных арендаторов.'],
    consignBtn: ['Ký gửi căn hộ', 'List your apartment', 'Разместить квартиру'],
    fAbout: ['Căn hộ thuê dài hạn từ 6 tháng tại trung tâm Quy Nhơn.', 'Long-term apartment rentals from 6 months in central Quy Nhon.', 'Долгосрочная аренда квартир от 6 месяцев в центре Куинёна.'],
    fExplore: ['Khám phá', 'Explore', 'Разделы'],
    fHours: ['Hằng ngày 8:00–20:00', 'Daily 8:00–20:00', 'Ежедневно 8:00–20:00'],
    fLang: ['Ngôn ngữ', 'Language', 'Язык'],
    home: ['Trang chủ', 'Home', 'Главная'],
    code: ['Mã căn', 'Code', 'Код'],
    updated: ['Cập nhật', 'Updated', 'Обновлено'],
    showAll: ['Xem tất cả ảnh', 'Show all photos', 'Все фото'],
    video: ['Video', 'Video', 'Видео'],
    keyFacts: ['Thông tin chính', 'Key facts', 'Основное'],
    costs: ['Chi phí hằng tháng', 'Monthly costs', 'Ежемесячные расходы'],
    terms: ['Điều khoản thuê', 'Rental terms', 'Условия аренды'],
    unitAm: ['Tiện nghi căn hộ', 'In the apartment', 'В квартире'],
    bldAm: ['Tiện ích toà nhà', 'Building amenities', 'В жилом комплексе'],
    location: ['Vị trí', 'Location', 'Расположение'],
    similar: ['Căn hộ tương tự', 'Similar apartments', 'Похожие квартиры'],
    area: ['Diện tích', 'Area', 'Площадь'], bedrooms: ['Phòng ngủ', 'Bedrooms', 'Спальни'], baths: ['Phòng tắm', 'Bathrooms', 'Санузлы'], floor: ['Tầng', 'Floor', 'Этаж'],
    direction: ['Hướng', 'Facing', 'Окна выходят на'], view: ['Tầm nhìn', 'View', 'Вид'], furniture: ['Nội thất', 'Furniture', 'Мебель'], building: ['Toà nhà', 'Building', 'Комплекс'],
    d_N: ['Bắc', 'North', 'север'], d_NE: ['Đông Bắc', 'North-east', 'северо-восток'], d_E: ['Đông', 'East', 'восток'], d_SE: ['Đông Nam', 'South-east', 'юго-восток'], d_S: ['Nam', 'South', 'юг'], d_SW: ['Tây Nam', 'South-west', 'юго-запад'], d_W: ['Tây', 'West', 'запад'], d_NW: ['Tây Bắc', 'North-west', 'северо-запад'],
    v_sea: ['View biển', 'Sea view', 'Вид на море'], v_city: ['View thành phố', 'City view', 'Вид на город'], v_river: ['View sông', 'River view', 'Вид на реку'], v_lagoon: ['View đầm', 'Lagoon view', 'Вид на лагуну'],
    cRent: ['Tiền thuê', 'Rent', 'Аренда'], cMgmt: ['Phí quản lý', 'Management fee', 'Обслуживание дома'], cPark: ['Gửi xe máy (1 xe)', 'Motorbike parking (1)', 'Парковка мотобайка (1)'], cNet: ['Internet', 'Internet', 'Интернет'],
    included: ['Đã bao gồm', 'Included', 'Включено'], total: ['Tổng ước tính', 'Estimated total', 'Итого, примерно'],
    costNote: ['Ước tính theo dữ liệu chủ nhà. Chưa gồm điện, nước.', 'Estimate from owner data. Excludes electricity and water.', 'Оценка по данным владельца. Без учёта электричества и воды.'],
    cCar: ['Gửi ô tô (nếu cần)', 'Car parking (if needed)', 'Парковка авто (по желанию)'],
    deposit: ['Đặt cọc', 'Deposit', 'Депозит'], cycle: ['Kỳ thanh toán', 'Payment cycle', 'Оплата'], cy_m1: ['Hằng tháng', 'Monthly', 'Ежемесячно'], cy_m3: ['3 tháng/lần', 'Every 3 months', 'Раз в 3 месяца'],
    minTerm: ['Thời hạn tối thiểu', 'Minimum term', 'Минимальный срок'], maxOcc: ['Số người ở tối đa', 'Max occupants', 'Макс. жильцов'], petsT: ['Thú cưng', 'Pets', 'Животные'],
    tempReg: ['Hỗ trợ đăng ký tạm trú', 'Temporary residence registration support', 'Помощь с временной регистрацией'],
    elec: ['Điện', 'Electricity', 'Электричество'], water: ['Nước', 'Water', 'Вода'], carParkFee: ['Gửi ô tô', 'Car parking', 'Парковка авто'], motoParkFee: ['Gửi xe máy', 'Motorbike parking', 'Парковка мотобайка'], internet: ['Internet', 'Internet', 'Интернет'],
    el_evn: ['Giá EVN, theo công tơ', 'EVN tariff, metered', 'По тарифу EVN, по счётчику'], wa_meter: ['Theo đồng hồ', 'Metered', 'По счётчику'],
    yes: ['Có', 'Yes', 'Да'], no: ['Không', 'No', 'Нет'], allowed: ['Được phép', 'Allowed', 'Можно'], notAllowed: ['Không cho phép', 'Not allowed', 'Нельзя'],
    a_ac: ['Điều hoà', 'Air conditioning', 'Кондиционер'], a_washer: ['Máy giặt', 'Washing machine', 'Стиральная машина'], a_fridge: ['Tủ lạnh', 'Fridge', 'Холодильник'], a_heater: ['Bình nóng lạnh', 'Water heater', 'Водонагреватель'], a_kitchen: ['Bếp & dụng cụ nấu', 'Kitchen & cookware', 'Кухня с посудой'], a_tv: ['TV', 'TV', 'Телевизор'], a_wifi: ['Wi-Fi', 'Wi-Fi', 'Wi-Fi'], a_balcony: ['Ban công', 'Balcony', 'Балкон'], a_wardrobe: ['Giường & tủ quần áo', 'Beds & wardrobes', 'Кровати и шкафы'], a_desk: ['Bàn làm việc', 'Work desk', 'Рабочий стол'],
    b_pool: ['Hồ bơi', 'Swimming pool', 'Бассейн'], b_gym: ['Phòng gym', 'Gym', 'Спортзал'], b_security: ['Bảo vệ 24/7', '24/7 security', 'Охрана 24/7'], b_lift: ['Thang máy', 'Elevators', 'Лифты'], b_basement: ['Hầm gửi xe', 'Underground parking', 'Подземный паркинг'], b_mart: ['Siêu thị mini', 'Mini-mart', 'Минимаркет'], b_kids: ['Khu vui chơi trẻ em', 'Kids’ playground', 'Детская площадка'],
    ward: ['Phường —', 'Ward —', 'Район —'],
    city: ['Quy Nhơn', 'Quy Nhon', 'Куинён'],
    mapPh: ['bản đồ · ghim vị trí toà nhà', 'map · building pin', 'карта · метка комплекса'],
    viewBld: ['Xem toà nhà', 'View building', 'О комплексе'],
    prefilled: ['Tin nhắn soạn sẵn', 'Prefilled message', 'Готовое сообщение'],
    orRequest: ['hoặc đặt lịch xem', 'or request a viewing', 'или запишитесь на просмотр'],
    vrTitle: ['Đặt lịch xem nhà', 'Request a viewing', 'Записаться на просмотр'],
    vrName: ['Họ tên', 'Name', 'Имя'], vrPhone: ['Số điện thoại', 'Phone', 'Телефон'], vrDate: ['Ngày muốn xem', 'Preferred viewing date', 'Желаемая дата просмотра'], vrDur: ['Thời gian thuê', 'Rental duration', 'Срок аренды'],
    dur0: ['6 tháng', '6 months', '6 месяцев'], dur1: ['12 tháng', '12 months', '12 месяцев'], dur2: ['Trên 12 tháng', 'Over 12 months', 'Более 12 месяцев'],
    vrNamePh: ['Nguyễn Văn An', 'Anna Smith', 'Анна Смирнова'],
    vrSubmit: ['Gửi yêu cầu', 'Send request', 'Отправить заявку'],
    vrDone: ['Đã nhận yêu cầu', 'Request received', 'Заявка получена'],
    vrDoneSub: ['Chúng tôi sẽ liên hệ lại sớm.', 'We’ll get back to you shortly.', 'Мы скоро свяжемся с вами.'],
    vrAgain: ['Gửi yêu cầu khác', 'Send another', 'Отправить ещё'],
    call: ['Gọi điện', 'Call', 'Позвонить'],
    cfTitle: ['Ký gửi căn hộ', 'List your apartment', 'Разместить квартиру'],
    cfSub: ['Điền thông tin cơ bản — chúng tôi sẽ liên hệ để xác minh.', 'Share the basics — we’ll contact you to verify.', 'Укажите основное — мы свяжемся для проверки.'],
    cfUnit: ['Thông tin căn', 'Unit details', 'О квартире'], cfContact: ['Liên hệ chủ nhà', 'Owner contact', 'Контакты владельца'],
    cfRent: ['Giá thuê mong muốn (₫/tháng)', 'Asking rent (₫/month)', 'Желаемая аренда (₫/мес.)'],
    cfPhotos: ['Ảnh căn hộ', 'Photos', 'Фотографии'], cfDrop: ['Kéo thả ảnh vào đây hoặc chọn tệp', 'Drag photos here or browse', 'Перетащите фото сюда или выберите файлы'], cfDropHint: ['JPG, PNG · tối đa 20 ảnh', 'JPG, PNG · up to 20 photos', 'JPG, PNG · до 20 фото'],
    cfSubmit: ['Gửi thông tin', 'Submit', 'Отправить'],
    selectPh: ['Chọn…', 'Select…', 'Выберите…'],
    listView: ['Danh sách', 'List', 'Список'], mapView: ['Bản đồ', 'Map', 'Карта'],
    studio: ['Studio', 'Studio', 'Студия'],
    callShort: ['Gọi', 'Call', 'Звонок'], forRent: ['Cho thuê', 'For rent', 'Аренда'],
    vrShort: ['Hẹn xem căn', 'Book viewing', 'Просмотр'], moreFilters: ['Thêm bộ lọc', 'More filters', 'Ещё фильтры'], menu: ['Menu', 'Menu', 'Меню'], langName_vi: ['Tiếng Việt', 'Tiếng Việt', 'Tiếng Việt'], langName_en: ['English', 'English', 'English'], langName_ru: ['Русский', 'Русский', 'Русский'], apply: ['Áp dụng', 'Apply', 'Применить'],
    results: ['Căn hộ cho thuê tại Quy Nhơn', 'Apartments for rent in Quy Nhon', 'Квартиры в аренду в Куинёне'],
    sort: ['Sắp xếp', 'Sort', 'Сортировка'], sort_new: ['Mới cập nhật', 'Recently updated', 'Недавно обновлённые'], sort_low: ['Giá thấp → cao', 'Price: low to high', 'Сначала дешевле'], sort_high: ['Giá cao → thấp', 'Price: high to low', 'Сначала дороже'], sort_move: ['Dọn vào sớm nhất', 'Earliest move-in', 'Ранний заезд'],
    showRented: ['Hiện căn đã cho thuê', 'Show rented', 'Показать сданные'],
    noRes: ['Không có căn phù hợp', 'No matching apartments', 'Нет подходящих квартир'], noResSub: ['Thử bỏ bớt một vài bộ lọc.', 'Try removing a filter or two.', 'Попробуйте убрать часть фильтров.'],
    clearAll: ['Xoá bộ lọc', 'Clear filters', 'Сбросить фильтры'],
    mapNote: ['bản đồ minh hoạ · vị trí ghim tương đối', 'illustrative map · pins approximate', 'схема · метки приблизительные'],
    bldUnits: ['Căn đang cho thuê', 'Apartments for rent', 'Квартиры в аренде'], bldFees: ['Phí trong toà nhà', 'Building fees', 'Платежи в комплексе'],
    mgmtRate: ['Phí quản lý', 'Management fee', 'Обслуживание'], rentRange: ['Giá thuê', 'Rent', 'Аренда'], feeNote: ['Theo các căn đang cho thuê trong toà. Mức cụ thể ghi trên từng căn.', 'Based on current listings in this building. Exact figures are on each apartment.', 'По текущим объявлениям в комплексе. Точные суммы — в карточке квартиры.'],
    askBld: ['Hỏi về toà nhà này', 'Ask about this building', 'Спросить о комплексе'],
    noUnits: ['Hiện chưa có căn trống trong toà này. Nhắn cho chúng tôi — sẽ báo khi có căn.', 'No apartments available here right now. Message us and we’ll let you know when one opens up.', 'Сейчас свободных квартир нет. Напишите нам — сообщим, когда появятся.'],
    otherBlds: ['Toà nhà khác', 'Other buildings', 'Другие комплексы'],
    cgEyebrow: ['Dành cho chủ nhà', 'For owners', 'Для владельцев'],
    cgTitle: ['Cho thuê căn hộ của bạn với khách thuê dài hạn', 'Rent out your apartment to long-term tenants', 'Сдайте квартиру на долгий срок'],
    cgSub: ['Ký gửi miễn phí. Chúng tôi xác minh, chụp ảnh, đăng tin bằng 3 ngôn ngữ và đưa khách đến xem.', 'Free to list. We verify, photograph, publish in 3 languages and bring tenants to view.', 'Размещение бесплатно. Мы проверим квартиру, сделаем фото, опубликуем на 3 языках и приведём арендаторов.'],
    cgHow: ['Quy trình', 'How it works', 'Как это работает'],
    cs1t: ['Gửi thông tin', 'Send the basics', 'Отправьте данные'], cs1d: ['Toà nhà, diện tích, giá mong muốn và vài ảnh chụp bằng điện thoại.', 'Building, size, asking rent and a few phone photos.', 'Комплекс, площадь, желаемая цена и несколько фото с телефона.'],
    cs2t: ['Xác minh tận nơi', 'On-site check', 'Проверка на месте'], cs2d: ['Chúng tôi đến căn hộ, kiểm tra tình trạng và chụp ảnh chuẩn.', 'We visit, check the condition and take proper photos.', 'Приезжаем, проверяем состояние и делаем качественные фото.'],
    cs3t: ['Đăng tin & dẫn khách', 'Publish & show', 'Публикация и показы'], cs3d: ['Tin đăng bằng tiếng Việt, Anh, Nga. Chúng tôi lọc khách và dẫn đi xem.', 'Listed in Vietnamese, English and Russian. We screen tenants and run viewings.', 'Объявление на вьетнамском, английском и русском. Отбираем арендаторов и проводим показы.'],
    cs4t: ['Ký hợp đồng', 'Sign the lease', 'Договор'], cs4d: ['Hợp đồng từ 6 tháng, hỗ trợ đăng ký tạm trú cho khách.', 'Leases from 6 months, with residence registration support.', 'Договор от 6 месяцев, помощь с временной регистрацией.'],
    cgArea: ['Chúng tôi nhận căn tại các toà nhà sau', 'We accept apartments in these buildings', 'Принимаем квартиры в этих комплексах'],
    cgAreaSub: ['Chỉ khu trung tâm Quy Nhơn. Căn ở toà khác? Vẫn gửi — chúng tôi sẽ phản hồi.', 'Central Quy Nhon only. Different building? Send it anyway — we’ll reply.', 'Только центр Куинёна. Другой дом? Всё равно отправьте — мы ответим.'],
    sending: ['Đang gửi…', 'Sending…', 'Отправка…'], sendErr: ['Chưa gửi được. Vui lòng thử lại hoặc gọi cho chúng tôi.', 'Couldn’t send. Please try again or call us.', 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.'],
    cfDone: ['Đã nhận thông tin căn hộ', 'We’ve got your apartment details', 'Данные о квартире получены'], cfDoneSub: ['Chúng tôi sẽ gọi lại trong 1 ngày làm việc để hẹn lịch xác minh.', 'We’ll call within one business day to schedule the check.', 'Позвоним в течение рабочего дня, чтобы договориться о проверке.']
  };
  const t = (k, l) => (T[k] ? T[k][ix(l)] : k);

  const money = (n, l) => new Intl.NumberFormat(TAG[l] || 'vi-VN').format(n) + ' ₫';
  const mil = (n, l) => { const v = new Intl.NumberFormat(TAG[l] || 'vi-VN', { maximumFractionDigits: 1 }).format(n / 1e6); return l === 'vi' ? v + ' triệu' : l === 'ru' ? v + ' млн ₫' : v + 'M ₫'; };
  const dShort = (s, l) => new Date(s + 'T00:00:00').toLocaleDateString(TAG[l], { day: 'numeric', month: 'short' });
  const dFull = (s, l) => new Date(s + 'T00:00:00').toLocaleDateString(TAG[l], { day: '2-digit', month: '2-digit', year: 'numeric' });
  const m2 = (l) => (l === 'ru' ? 'м²' : 'm²');
  const F = {
    beds: (n, l) => (l === 'vi' ? n + ' PN' : l === 'ru' ? n + ' ' + pl(n, 'спальня', 'спальни', 'спален') : n + ' bd'),
    bedsLong: (n, l) => (l === 'vi' ? n + ' phòng ngủ' : l === 'ru' ? n + ' ' + pl(n, 'спальня', 'спальни', 'спален') : n + (n === 1 ? ' bedroom' : ' bedrooms')),
    floor: (n, l) => (l === 'vi' ? 'Tầng ' + n : l === 'ru' ? n + ' этаж' : 'Floor ' + n),
    units: (n, l) => (l === 'vi' ? n + ' căn đang cho thuê' : l === 'ru' ? n + ' ' + pl(n, 'квартира', 'квартиры', 'квартир') + ' в аренде' : n + (n === 1 ? ' apartment' : ' apartments') + ' for rent'),
    photos: (n, l) => (l === 'vi' ? n + ' ảnh' : l === 'ru' ? n + ' фото' : n + ' photos'),
    months: (n, l) => (l === 'vi' ? n + ' tháng' : l === 'ru' ? n + ' ' + pl(n, 'месяц', 'месяца', 'месяцев') : n + (n === 1 ? ' month' : ' months')),
    people: (n, l) => (l === 'vi' ? n + ' người' : l === 'ru' ? n + ' ' + pl(n, 'человек', 'человека', 'человек') : n + ' people'),
    showN: (n, l) => (l === 'vi' ? 'Xem ' + n + ' căn' : l === 'ru' ? 'Показать ' + n + ' ' + pl(n, 'квартиру', 'квартиры', 'квартир') : 'Show ' + n + ' apartments'),
    found: (n, l) => (l === 'vi' ? n + ' căn phù hợp' : l === 'ru' ? n + ' ' + pl(n, 'квартира', 'квартиры', 'квартир') : n + (n === 1 ? ' apartment' : ' apartments')),
    perM2: (n, l) => money(n, l) + '/' + m2(l) + (l === 'vi' ? '/tháng' : l === 'ru' ? '/мес.' : '/mo'),
    msgG: (l) => (l === 'vi' ? 'Chào ApartQN, tôi cần tư vấn thuê căn hộ dài hạn.' : l === 'ru' ? 'Здравствуйте! Нужна консультация по долгосрочной аренде.' : 'Hi ApartQN, I’d like help finding a long-term rental.'),
    msgB: (n, l) => (l === 'vi' ? 'Chào ApartQN, tôi muốn hỏi về căn hộ tại ' + n + '.' : l === 'ru' ? 'Здравствуйте! Интересуют квартиры в ' + n + '.' : 'Hi ApartQN, I’d like to ask about apartments at ' + n + '.'),
    msg: (c, l) => (l === 'vi' ? 'Chào ApartQN, tôi quan tâm căn ' + c + '.' : l === 'ru' ? 'Здравствуйте! Интересует квартира ' + c + '.' : 'Hi ApartQN, I’m interested in apartment ' + c + '.'),
    elecFixed: (l) => (l === 'vi' ? 'Cố định ' : l === 'ru' ? 'Фикс. ' : 'Fixed ') + money(3500, l) + (l === 'ru' ? '/кВт·ч' : '/kWh'),
    waterPerson: (l) => money(100000, l) + (l === 'vi' ? '/người/tháng' : l === 'ru' ? ' с человека в мес.' : ' per person/mo')
  };

  const listing = (c) => L.find((x) => x.code === c) || L[0];
  const building = (id) => B.find((x) => x.id === id) || B[0];
  const total = (x) => x.rent + x.mgmt + x.moto + x.net;
  const STATUS = { available: ['#1E7F4F', '#E6F4EC'], reserved: ['#8A5200', '#FDF0D8'], rented: ['#4A5160', '#EDEFF2'] };
  const UNIT_AM = { full: ['ac', 'washer', 'fridge', 'heater', 'kitchen', 'tv', 'wifi', 'balcony', 'wardrobe', 'desk'], basic: ['ac', 'heater', 'kitchen', 'balcony', 'wardrobe'], empty: ['heater', 'balcony'] };

  const card = (x, l) => {
    const b = building(x.b), s = STATUS[x.status];
    return {
      code: x.code, rent: money(x.rent, l), per: t('perMonth', l), est: money(total(x), l), estLabel: t('estMonthly', l),
      meta: [F.beds(x.beds, l), x.area + ' ' + m2(l), F.floor(x.floor, l)].join(' · '),
      bname: b.name, street: b.street, moveIn: t('moveInFrom', l) + ' ' + dShort(x.moveIn, l),
      status: t('st_' + x.status, l), stFg: s[0], stBg: s[1], verified: x.verified, verifiedLabel: t('verified', l),
      photos: x.photos, title: F.bedsLong(x.beds, l) + ' · ' + t('v_' + x.view, l)
    };
  };
  const contacts = (code, l, msg) => {
    const m = encodeURIComponent(msg || F.msg(code, l));
    const all = {
      zalo: { k: 'zalo', label: 'Zalo', href: 'https://zalo.me/0900000000' },
      call: { k: 'call', label: t('call', l), href: 'tel:+84900000000' },
      telegram: { k: 'telegram', label: 'Telegram', href: 'https://t.me/apartqn?text=' + m },
      whatsapp: { k: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/84900000000?text=' + m }
    };
    const order = l === 'vi' ? ['zalo', 'call'] : l === 'ru' ? ['telegram', 'whatsapp'] : ['whatsapp', 'telegram'];
    return order.map((k) => all[k]);
  };

  const RENT = [[0, 8e6], [8e6, 12e6], [12e6, 18e6], [18e6, Infinity]];
  const EMPTY = { b: '', beds: '', rent: '', furn: '', pets: false, date: '', rented: false };
  const match = (x, f) => (f.rented || x.status !== 'rented') && (!f.b || x.b === f.b) && (!f.pets || x.pets) && (!f.furn || x.furn === f.furn) &&
    (!f.beds || (f.beds === '3' ? x.beds >= 3 : String(x.beds) === f.beds)) &&
    (!f.rent || (x.rent >= RENT[+f.rent.slice(1)][0] && x.rent < RENT[+f.rent.slice(1)][1])) && (!f.date || x.moveIn <= f.date);
  const PAGES = { home: 'Home.dc.html', results: 'Results.dc.html', listing: 'Listing%20Detail.dc.html', building: 'Building.dc.html', consign: 'Consign.dc.html' };
  const link = (p, params, l) => { const q = new URLSearchParams(); Object.entries(params || {}).forEach(([k, v]) => { if (v !== '' && v != null && v !== false) q.set(k, v === true ? '1' : v); }); if (l && l !== 'vi') q.set('l', l); const s = q.toString(); return PAGES[p] + (s ? '?' + s : ''); };
  const qp = (k) => { try { return new URLSearchParams(location.search).get(k); } catch (_) { return null; } };
  const qFilters = () => { const f = Object.assign({}, EMPTY); Object.keys(EMPTY).forEach((k) => { const v = qp(k); if (v != null) f[k] = typeof EMPTY[k] === 'boolean' ? v === '1' : v; }); return f; };
  const NAV = [['navApts', 'results'], ['navBlds', 'home', '#buildings'], ['navConsign', 'consign']];
  const navLinks = (l) => NAV.map(([k, p, h]) => ({ k: p === 'home' ? 'building' : p, label: t(k, l), href: link(p, {}, l) + (h || '') })).concat([{ k: 'contact', label: t('navContact', l), href: '#contact' }]);

  // Breakpoints 360 / 768 / 1024 / 1280 · container 1200 · side padding 16 / 24 / 32
  const layout = (w) => {
    const bp = w >= 1024 ? 'lg' : w >= 768 ? 'md' : 'sm', px = bp === 'lg' ? 32 : bp === 'md' ? 24 : 16;
    return { w, bp, sm: bp === 'sm', md: bp === 'md', lg: bp === 'lg', ltLg: bp !== 'lg', geMd: bp !== 'sm', xs: w < 400, px: px + 'px', nx: -px + 'px', hdr: bp === 'lg' ? 72 : 60, cols: bp === 'lg' ? 3 : bp === 'md' ? 2 : 1 };
  };
  const initW = (props) => (props.device === 'mobile' ? 390 : props.device === 'tablet' ? 768 : props.device === 'desktop' ? 1280 : (window.innerWidth || 1280));
  const EMAIL = 'phanhuutuan1010@gmail.com';
  const send = (subject, fields) => fetch('https://formsubmit.co/ajax/' + EMAIL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(Object.assign({ _subject: subject, _template: 'table', _captcha: 'false' }, fields, { 'Trang': location.href }))
  }).then((r) => r.json()).then((j) => { if (!(j && (j.success === true || j.success === 'true'))) throw new Error(j && j.message || 'send failed'); return j; });

  window.AQN = { layout, initW, EMAIL, send, navLinks, RENT, EMPTY, match, PAGES, link, qp, qFilters, NAV, LOCS, B, L, T, t, F, money, mil, dShort, dFull, m2, listing, building, total, card, contacts, UNIT_AM, STATUS, pl };
})();
