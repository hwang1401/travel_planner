/* ── Icon Helper ── */
const ICON_MAP = {
  /* ── Button icons (solid, for action triggers) ── */
  close: "/icons/Close/Close.svg",
  edit: "/icons/Edit/Edit 1.svg",
  trash: "/icons/Trash/Trash 2.svg",
  plus: "/icons/Plus/Plus.svg",
  plusCircle: "/icons/Plus/Circle.svg",
  sync: "/icons/Sync.svg",
  /* ── Flat icons (for text/header companions) ── */
  map: "/icons/Map.svg",
  pin: "/icons/Pin.svg",
  clock: "/icons/Clock.svg",
  calendar: "/icons/Calendar.svg",
  pricetag: "/icons/Pricetag.svg",
  file: "/icons/File/File.svg",
  home: "/icons/Home.svg",
  shopping: "/icons/Shopping/Bag.svg",
  briefcase: "/icons/Briefcase.svg",
  navigation: "/icons/Navigation/Navigation 1.svg",
  bookmark: "/icons/Bookmark.svg",
  flash: "/icons/Flash/On.svg",
  lock: "/icons/Lock.svg",
  globe: "/icons/Globe/Globe 1.svg",
  car: "/icons/Car.svg",
  compass: "/icons/Compass.svg",
  fire: "/icons/Fire.svg",
  bulb: "/icons/Bulb.svg",
  bookOpen: "/icons/Book/Open.svg",
  info: "/icons/Info.svg",
  flag: "/icons/Flag.svg",
  star: "/icons/Star/fiiled.svg",
  chevronDown: "/icons/Arrow/Chevron/Down.svg",
  chevronUp: "/icons/Arrow/Chevron/Up.svg",
  chevronRight: "/icons/Arrow/Chevron/Right.svg",
  chevronLeft: "/icons/Arrow/Chevron/Left.svg",
  check: "/icons/Checkmark/Checkmark.svg",
  externalLink: "/icons/External Link.svg",
  swap: "/icons/Swap.svg",
  list: "/icons/List.svg",
  search: "/icons/Search.svg",
  person: "/icons/Person/Person.svg",
  persons: "/icons/Person/Persones.svg",
  share: "/icons/Share.svg",
  copy: "/icons/Copy.svg",
};

export { ICON_MAP };

export default function Icon({ name, size = 16, style = {}, className = "" }) {
  const src = ICON_MAP[name] || name;
  return <img src={src} alt="" width={size} height={size} style={{ display: "block", flexShrink: 0, ...style }} className={className} />;
}
