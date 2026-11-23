// Кейсы на сайте. Порядок в списке = порядок в сетке.
//
// Медиа лежат в Cloudflare R2 (https://media.o-dio.design), папка = id кейса.
// В src пишем путь внутри хранилища: "avorio/cover.webp".
// Пока src пустой, на месте картинки рисуется заглушка.
//
// cover:   { type: "image" | "video", src, poster? }  — обложка в сетке
// gallery: [{ type: "image" | "video", src, alt? }]    — картинки в модальном окне
// wip:     true — проект в работе (метка «In progress»)
//
// Тексты описаний — черновики, проверить.

window.MEDIA_BASE = "https://media.o-dio.design/";

window.CASES = [
  {
    id: "avorio",
    name: "Avorio",
    sector: "Italian furniture, Dubai",
    services: ["Branding", "UX/UI", "Website", "Catalogue"],
    description:
      "Avorio represents Italian furniture brands in Dubai. We built the brand and a website with a catalogue of partner brands.",
    cover: { type: "image", src: "" },
    gallery: [],
  },
  {
    id: "segrex-brokers-club",
    name: "Segrex Brokers Club",
    sector: "Real estate, fintech, UAE",
    services: ["Product design", "Development", "Mobile"],
    description:
      "A gamified platform for real estate brokers, integrated with Bitrix24. We designed and built the product, from the system of screens to the mobile version.",
    cover: { type: "image", src: "" },
    gallery: [],
  },
  {
    id: "segrex-development",
    name: "Segrex Development",
    sector: "Real estate developer, Dubai",
    services: ["Website", "Sales analytics"],
    description:
      "A corporate website for a Dubai developer, with sales analytics built in.",
    cover: { type: "image", src: "" },
    gallery: [],
  },
  {
    id: "altamare",
    name: "Altamare",
    sector: "Superyacht refit, Dubai",
    services: ["Website"],
    description:
      "A website for a superyacht refit company in Dubai.",
    wip: true,
    cover: { type: "image", src: "" },
    gallery: [],
  },
  {
    id: "restolab",
    name: "Restolab",
    sector: "Turnkey restaurants",
    services: ["Naming", "Identity", "Website"],
    description:
      "Restolab launches restaurants turnkey. We named the company, built its identity and the website.",
    cover: { type: "image", src: "" },
    gallery: [],
  },
  {
    id: "sulina-design",
    name: "Sulina Design",
    sector: "Interior design",
    services: ["Website"],
    description:
      "A website for an interior design studio.",
    cover: { type: "image", src: "" },
    gallery: [],
  },
];
