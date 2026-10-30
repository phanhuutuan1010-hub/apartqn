import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getBuildings, getContact, getPricesFrom, getUnitTypes } from '@/lib/repo';
import { contactLinks } from '@/lib/contacts';
import { telHref, toLocal } from '@/lib/phone';
import { ruAlternates, ruType, rub } from '@/lib/ruPage';
import { bedsOfType, type UnitTypeKind } from '@/lib/unitTypes';
import { ratioOf } from '@/lib/types';
import { Logo } from '@/components/Logo';
import { Photo } from '@/components/Photo';
import { IconTelegram, IconWhatsApp } from '@/components/ChannelIcons';
import { RuChat } from '@/components/ru/RuChat';
import s from './ru.module.css';

export const revalidate = 300;

const TITLE = 'Переезд из Нячанга в Куиньон — аренда квартир от 6 месяцев | ApartQN';
const DESC = 'Куиньон — спокойный город у моря. Меблированные квартиры в центре, аренда от 6 месяцев. Как добраться из Нячанга, где работать онлайн, первые дни в городе.';
/** typed into Telegram / WhatsApp when the chat opens */
const MESSAGE = 'Здравствуйте! Пишу со страницы apartqn.com/ru. Интересует аренда квартиры от 6 месяцев.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: ruAlternates,
  openGraph: { title: TITLE, description: DESC, locale: 'ru_RU', type: 'website', siteName: 'ApartQN', url: ruAlternates.canonical },
};

/** "+84 906 051 010" */
const intl = (p: string) => {
  const d = toLocal(p);
  return /^0\d{9}$/.test(d) ? `+84 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : p.trim();
};

/**
 * Russian landing page for people moving from Nha Trang: one server-rendered page (not a locale). The apartment types
 * (sample units, "from" prices) come right after a compact hero, cheapest first — never availability or a single unit;
 * the "from" prices per type come from those types (Cài đặt as the fallback); the chat links are the English Telegram /
 * WhatsApp links, logged with origin 'ru-page'.
 */
export default async function RuPage() {
  const [contact, settingsPrices, all, buildings] = await Promise.all([getContact(), getPricesFrom(), getUnitTypes(), getBuildings()]);
  const links = contactLinks(contact, '', MESSAGE);
  const tg = links.telegram?.href, wa = links.whatsapp?.href;
  const types = [...all].sort((a, b) => a.priceFrom - b.priceFrom);
  const from = (k: UnitTypeKind, d: number) => {
    const ps = types.filter((x) => x.type === k).map((x) => x.priceFrom);
    return ps.length ? Math.min(...ps) : d;
  };
  const prices = { studio: from('studio', settingsPrices.studio), br1: from('1pn', settingsPrices.br1), br2: from('2pn', settingsPrices.br2) };
  const bName = new Map(buildings.map((b) => [b.id, b.name]));
  const phone = contact.whatsapp ?? contact.hotline;

  /** small Telegram / WhatsApp links (hero, under the list) */
  const chatSmall = (tg || wa) ? (
    <span className={s.chatSmall}>
      {tg && <RuChat href={tg} channel="telegram" className={s.chatLink}><IconTelegram size={18} /> Telegram</RuChat>}
      {wa && <RuChat href={wa} channel="whatsapp" className={s.chatLink}><IconWhatsApp size={18} /> WhatsApp</RuChat>}
    </span>
  ) : null;

  return (
    <>
      <header className={s.top}>
        <div className={`container ${s.topIn}`}>
          <Link href="/en" aria-label="ApartQN"><Logo size={22} /></Link>
        </div>
      </header>

      <main>
        <section className={s.hero}>
          {/* the homepage hero photo (same file), darkened for the white text */}
          <Image src="/images/hero-quy-nhon-2000.webp" alt="" fill preload sizes="100vw" className={s.heroImg} />
          <div className={`container ${s.heroIn}`}>
            <h1 className={s.h1}>Куиньон — море, тишина и своя квартира</h1>
            <p className={s.lead}>Переезжаете из Нячанга? Поможем найти квартиру в центре Куиньона на срок от 6 месяцев. Все квартиры полностью меблированы — можно заезжать сразу.</p>
            <div className={s.heroCta}>
              <a href="#kvartiry" className={`btn btn-primary ${s.seeBtn}`}>Смотреть квартиры</a>
              {chatSmall}
            </div>
          </div>
        </section>

        <div className={`container ${s.body}`}>
          <section className={s.sec} id="kvartiry">
            <h2 className={s.h2}>Квартиры по типам</h2>
            <p className={s.pTop}>Фото — образец квартиры этого типа. Какие квартиры свободны сейчас, уточните у нас.</p>
            {types.length === 0 ? (
              <p className={s.empty}>Варианты скоро появятся. Напишите нам — подберём квартиру по вашему запросу.</p>
            ) : (
              <ul className={s.grid}>
                {types.map((x, i) => {
                  const type = ruType(bedsOfType(x.type));
                  const building = bName.get(x.buildingId);
                  return (
                    <li key={x.code} className={s.card}>
                      <div className={s.photo}>
                        <Photo src={x.thumbs[0]} srcSet={x.srcsets[0]} ratio={ratioOf(x.photoMeta?.[0])} alt={`${type} — квартира в Куиньоне`}
                          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" priority={i === 0} />
                      </div>
                      <div className={s.cardBody}>
                        <span className={s.code}>{x.code}{building && <> · {building}</>}</span>
                        <span className={s.type}>{type} · {x.areaMax > x.areaMin ? `${x.areaMin}–${x.areaMax}` : x.areaMin} м²</span>
                        <span className={s.rent}>от {rub(x.priceFrom)} VND/месяц</span>
                        <a href={`/en/${x.code}`} className={`btn btn-secondary ${s.more}`} hrefLang="en">Подробнее (на английском)</a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {chatSmall && (
              <div className={s.notFound}>
                <span>Не нашли подходящую? Напишите — подберём по вашему запросу.</span>
                {chatSmall}
              </div>
            )}
          </section>

          <section className={s.sec}>
            <h2 className={s.h2}>Цены</h2>
            <p className={s.p}>
              Аренда в месяц: студия — от <b className={s.price}>{rub(prices.studio)} VND</b>, 1 спальня — от <b className={s.price}>{rub(prices.br1)} VND</b>,
              {' '}2 спальни — от <b className={s.price}>{rub(prices.br2)} VND</b>.
            </p>
            <p className={s.p}>Цена зависит от расположения дома, вида, мебели, срока аренды и наличия домашних животных.</p>
          </section>

          <div className={s.duo}>
            <section className={s.sec}>
              <h2 className={s.h2}>Один день в Куиньоне</h2>
              <ul className={s.list}>
                <li>Утро — купание или пробежка на городском пляже вдоль набережной.</li>
                <li>День — работа с ноутбуком в кафе в центре.</li>
                <li>Вечер — прогулка у моря и свежие морепродукты.</li>
                <li>Выходные — бухта Ky Co, мыс Eo Gio, рыбацкие деревни Bai Xep и Nhon Ly.</li>
              </ul>
            </section>

            <section className={s.sec}>
              <h2 className={s.h2}>Где работать онлайн</h2>
              <p className={s.pTop}>Больших коворкингов в Куиньоне пока нет, но есть кафе, где удобно работать с ноутбуком:</p>
              <ul className={s.list}>
                <li>S.Blue Coffee — на пляже, у центральной площади</li>
                <li>Marina Coffee — рядом с Co.opmart</li>
                <li>Santorino Coffee — тихое, с кондиционером</li>
                <li>Friendship Cafe — спокойное место для созвонов</li>
              </ul>
              <p className={s.p}>Интернет в квартире — уточняйте по каждой квартире.</p>
            </section>

            <section className={s.sec}>
              <h2 className={s.h2}>Как добраться из Нячанга</h2>
              <ul className={s.list}>
                <li>Поезд — до станции Dieu Tri, оттуда на такси или Grab до центра Куиньона.</li>
                <li>Автобус или минивэн-лимузин — несколько рейсов в день, билеты можно купить онлайн.</li>
              </ul>
              <p className={s.p}>Нужна помощь с дорогой? Напишите — подскажем удобный вариант.</p>
            </section>

            <section className={s.sec}>
              <h2 className={s.h2}>Первые дни в Куиньоне</h2>
              <ul className={s.list}>
                <li>Связь — SIM-карты Viettel, Vinaphone, Mobifone в салонах операторов.</li>
                <li>Транспорт — Grab (такси и байк) или аренда байка.</li>
                <li>Продукты — супермаркеты Co.opmart и GO!, мини-маркеты WinMart и Circle K, рынки.</li>
                <li>Аптеки — Pharmacity, Long Chau.</li>
              </ul>
            </section>
          </div>

          <section className={s.sec}>
            <h2 className={s.h2}>Честно о Куиньоне</h2>
            <ul className={s.list}>
              <li>Развлечений меньше, чем в Нячанге — город живёт спокойнее.</li>
              <li>Русскоязычное сообщество пока небольшое.</li>
              <li>Коворкингов почти нет — работают в кафе или дома.</li>
            </ul>
            <p className={s.p}>Если вам важны тишина и спокойный ритм — Куиньон подойдёт. Если нужна активная ночная жизнь — возможно, нет.</p>
          </section>

          <section className={s.sec}>
            <h2 className={s.h2}>О нас</h2>
            <p className={s.pTop}>ApartQN — местная команда. Мы живём в Куиньоне, сами показываем квартиры и помогаем с заселением.</p>
            <p className={s.p}>Общаемся на английском, на русском — через переводчик.</p>
          </section>

          <section className={s.sec}>
            <h2 className={s.h2}>Как снять квартиру</h2>
            <ol className={s.steps}>
              <li>Напишите нам в Telegram или WhatsApp.</li>
              <li>Пришлём фото и видео квартир.</li>
              <li>Приезжайте в Куиньон — подберём несколько квартир и покажем их за одну поездку.</li>
              <li>Заселяйтесь.</li>
            </ol>
          </section>

          <section className={s.sec}>
            <h2 className={s.h2}>Частые вопросы</h2>
            <div className={s.faq}>
              <details><summary>Минимальный срок аренды?</summary><p>6 месяцев.</p></details>
              <details><summary>Квартиры с мебелью?</summary><p>Да, все квартиры полностью меблированы.</p></details>
              <details><summary>Можно с домашними животными?</summary><p>Зависит от квартиры, цена может отличаться. Напишите нам.</p></details>
              <details><summary>Какие дополнительные расходы?</summary><p>Электричество, вода, интернет, обслуживание. Ориентировочные суммы указаны на странице каждого типа квартиры.</p></details>
            </div>
          </section>
        </div>

        <section className={s.final}>
          <div className="container">
            <p className={s.finalT}>Остались вопросы? Пишите — ответим по-английски или по-русски через переводчик.</p>
            <div className={s.finalLinks}>
              {tg && <RuChat href={tg} channel="telegram" className={s.finalLink}><IconTelegram size={20} /> Telegram</RuChat>}
              {wa && <RuChat href={wa} channel="whatsapp" className={s.finalLink}><IconWhatsApp size={20} /> WhatsApp</RuChat>}
              {phone && <a href={telHref(phone)} className={s.finalLink}>{intl(phone)}</a>}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
