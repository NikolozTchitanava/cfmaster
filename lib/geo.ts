import type { Continent } from "@/lib/types";

type CountryMeta = {
  code: string;
  continent: Continent;
  aliases?: string[];
};

const COUNTRY_DATA: Record<string, CountryMeta> = {
  Argentina: { code: "AR", continent: "South America" },
  Armenia: { code: "AM", continent: "Asia" },
  Australia: { code: "AU", continent: "Oceania" },
  Austria: { code: "AT", continent: "Europe" },
  Azerbaijan: { code: "AZ", continent: "Asia" },
  Bangladesh: { code: "BD", continent: "Asia" },
  Belarus: { code: "BY", continent: "Europe" },
  Belgium: { code: "BE", continent: "Europe" },
  Bolivia: { code: "BO", continent: "South America" },
  "Bosnia and Herzegovina": { code: "BA", continent: "Europe", aliases: ["Bosnia"] },
  Brazil: { code: "BR", continent: "South America" },
  Bulgaria: { code: "BG", continent: "Europe" },
  Canada: { code: "CA", continent: "North America" },
  Chile: { code: "CL", continent: "South America" },
  China: { code: "CN", continent: "Asia" },
  Colombia: { code: "CO", continent: "South America" },
  Croatia: { code: "HR", continent: "Europe" },
  Cuba: { code: "CU", continent: "North America" },
  Cyprus: { code: "CY", continent: "Asia" },
  "Czech Republic": { code: "CZ", continent: "Europe", aliases: ["Czechia"] },
  Denmark: { code: "DK", continent: "Europe" },
  "Dominican Republic": { code: "DO", continent: "North America" },
  Ecuador: { code: "EC", continent: "South America" },
  Egypt: { code: "EG", continent: "Africa" },
  Estonia: { code: "EE", continent: "Europe" },
  Finland: { code: "FI", continent: "Europe" },
  France: { code: "FR", continent: "Europe" },
  Georgia: { code: "GE", continent: "Asia" },
  Germany: { code: "DE", continent: "Europe" },
  Ghana: { code: "GH", continent: "Africa" },
  Greece: { code: "GR", continent: "Europe" },
  "Hong Kong": { code: "HK", continent: "Asia" },
  Hungary: { code: "HU", continent: "Europe" },
  Iceland: { code: "IS", continent: "Europe" },
  India: { code: "IN", continent: "Asia" },
  Indonesia: { code: "ID", continent: "Asia" },
  Iran: { code: "IR", continent: "Asia", aliases: ["Iran, Islamic Republic of"] },
  Iraq: { code: "IQ", continent: "Asia" },
  Ireland: { code: "IE", continent: "Europe" },
  Israel: { code: "IL", continent: "Asia" },
  Italy: { code: "IT", continent: "Europe" },
  Japan: { code: "JP", continent: "Asia" },
  Jordan: { code: "JO", continent: "Asia" },
  Kazakhstan: { code: "KZ", continent: "Asia" },
  Kenya: { code: "KE", continent: "Africa" },
  Kyrgyzstan: { code: "KG", continent: "Asia" },
  Latvia: { code: "LV", continent: "Europe" },
  Lebanon: { code: "LB", continent: "Asia" },
  Lithuania: { code: "LT", continent: "Europe" },
  Luxembourg: { code: "LU", continent: "Europe" },
  Malaysia: { code: "MY", continent: "Asia" },
  Mexico: { code: "MX", continent: "North America" },
  Moldova: { code: "MD", continent: "Europe", aliases: ["Moldova, Republic of"] },
  Mongolia: { code: "MN", continent: "Asia" },
  Morocco: { code: "MA", continent: "Africa" },
  Nepal: { code: "NP", continent: "Asia" },
  Netherlands: { code: "NL", continent: "Europe" },
  "New Zealand": { code: "NZ", continent: "Oceania" },
  Nigeria: { code: "NG", continent: "Africa" },
  "North Macedonia": { code: "MK", continent: "Europe", aliases: ["Macedonia"] },
  Norway: { code: "NO", continent: "Europe" },
  Pakistan: { code: "PK", continent: "Asia" },
  Peru: { code: "PE", continent: "South America" },
  Philippines: { code: "PH", continent: "Asia" },
  Poland: { code: "PL", continent: "Europe" },
  Portugal: { code: "PT", continent: "Europe" },
  Romania: { code: "RO", continent: "Europe" },
  "Russian Federation": { code: "RU", continent: "Europe", aliases: ["Russia"] },
  "Saudi Arabia": { code: "SA", continent: "Asia" },
  Serbia: { code: "RS", continent: "Europe" },
  Singapore: { code: "SG", continent: "Asia" },
  Slovakia: { code: "SK", continent: "Europe", aliases: ["Slovak Republic"] },
  Slovenia: { code: "SI", continent: "Europe" },
  "South Africa": { code: "ZA", continent: "Africa" },
  "South Korea": { code: "KR", continent: "Asia", aliases: ["Korea", "Korea, Republic of", "Republic of Korea"] },
  Spain: { code: "ES", continent: "Europe" },
  "Sri Lanka": { code: "LK", continent: "Asia" },
  Sweden: { code: "SE", continent: "Europe" },
  Switzerland: { code: "CH", continent: "Europe" },
  Syria: { code: "SY", continent: "Asia", aliases: ["Syrian Arab Republic"] },
  Taiwan: { code: "TW", continent: "Asia", aliases: ["Chinese Taipei"] },
  Tajikistan: { code: "TJ", continent: "Asia" },
  Thailand: { code: "TH", continent: "Asia" },
  Tunisia: { code: "TN", continent: "Africa" },
  Turkey: { code: "TR", continent: "Asia" },
  Turkmenistan: { code: "TM", continent: "Asia" },
  Ukraine: { code: "UA", continent: "Europe" },
  "United Arab Emirates": { code: "AE", continent: "Asia", aliases: ["UAE"] },
  "United Kingdom": { code: "GB", continent: "Europe", aliases: ["UK", "Great Britain"] },
  "United States": { code: "US", continent: "North America", aliases: ["USA", "United States of America"] },
  Uruguay: { code: "UY", continent: "South America" },
  Uzbekistan: { code: "UZ", continent: "Asia" },
  Venezuela: { code: "VE", continent: "South America" },
  "Viet Nam": { code: "VN", continent: "Asia", aliases: ["Vietnam"] }
};

const COUNTRY_LOOKUP = new Map<string, { name: string; meta: CountryMeta }>();

function keyForCountry(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

for (const [name, meta] of Object.entries(COUNTRY_DATA)) {
  COUNTRY_LOOKUP.set(keyForCountry(name), { name, meta });
  for (const alias of meta.aliases ?? []) {
    COUNTRY_LOOKUP.set(keyForCountry(alias), { name, meta });
  }
}

export function getCountryOptions(): string[] {
  return Object.keys(COUNTRY_DATA).sort((left, right) => left.localeCompare(right));
}

export function resolveCountryMetadata(value: string | null | undefined): {
  country: string | null;
  countryCode: string | null;
  continent: Continent | null;
} {
  if (!value) {
    return {
      country: null,
      countryCode: null,
      continent: null
    };
  }

  const match = COUNTRY_LOOKUP.get(keyForCountry(value));
  if (!match) {
    return {
      country: value.trim() || null,
      countryCode: null,
      continent: null
    };
  }

  return {
    country: match.name,
    countryCode: match.meta.code,
    continent: match.meta.continent
  };
}

export function getCountryFlag(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) {
    return "🌍";
  }

  return countryCode
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}
