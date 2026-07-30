/*
 * Ethnic, Ancestral & Cultural Background data for the paid Global Dream
 * Partner Report -- a richer, country-specific companion to the free
 * calculator's simple White/Black/Asian Race filter.
 *
 * Design principles (see project plan for full rationale):
 *  - Nationality, race, ethnicity, ancestry, and Indigenous identity are
 *    genuinely different concepts with different official measurement
 *    methods. Nothing here is inferred from a person's birthplace,
 *    surname, language, or religion -- every category below is a
 *    category that country's own census/statistics office actually
 *    publishes a population share for.
 *  - Coverage is intentionally limited to the handful of countries
 *    (US, UK, Canada, Australia, New Zealand, South Africa, Brazil)
 *    where real official figures are well-known enough to state with
 *    confidence, the same standard the rest of this site holds itself
 *    to. Every other country is "unsupported" here on purpose rather
 *    than filled in with a guess -- see countries.js's ANY_RACE pattern
 *    for the same philosophy applied to the simpler Race filter.
 *  - "Broad Global Categories" mode does NOT invent new percentages for
 *    unsupported countries. It only *regroups* the exact same real,
 *    sourced numbers below under a shared harmonized label (e.g. the
 *    UK's Indian/Pakistani/Bangladeshi categories and Canada's South
 *    Asian visible-minority category both roll up under
 *    "South Asian") so a broad label never carries a fabricated figure.
 *
 * Rounded, general-knowledge approximations for an entertainment tool,
 * same caveat as stats.js / countries.js / states.js. Real category
 * names and rough shares are sourced from each country's own national
 * statistics office; not connected to any live data feed.
 */

(function () {

// Shape reference (kept as plain JS, matching every other data file in
// this project -- no build step / TypeScript compiler here):
//
// HARMONIZED_GROUPS[id] = { displayName }
//
// COUNTRY_BACKGROUNDS[countryCode] = {
//   countryIso3,
//   limitations: [string...]  // country-level methodology caveats
//   categories: [{
//     id, displayName, classificationType,
//       // "race" | "ethnicity" | "ancestry" | "indigenous_identity" | "mixed_background"
//     share,              // 0-1, real published population share
//     harmonizedGroupId,  // key into HARMONIZED_GROUPS, or null if it
//                         // doesn't cleanly map to one
//     sourceName, sourceYear, sourceVariable,
//     dataCoverageTier,   // "direct" for everything below -- these are
//                         // all a real, direct official category, not
//                         // an outside proxy estimate
//     limitations,        // optional per-category caveat
//   }],
// }

const HARMONIZED_GROUPS = {
  european_ancestry: { displayName: "European ancestry" },
  sub_saharan_african_ancestry: { displayName: "Sub-Saharan African ancestry" },
  south_asian: { displayName: "South Asian" },
  east_asian: { displayName: "East Asian" },
  southeast_asian: { displayName: "Southeast Asian" },
  indigenous_peoples: { displayName: "Indigenous peoples" },
  pacific_islander: { displayName: "Pacific Islander" },
  latin_american_hispanic: { displayName: "Latin American / Hispanic origin" },
  mixed_multiracial: { displayName: "Mixed / multiracial background" },
  middle_eastern_north_african: { displayName: "Middle Eastern / North African" },
};

const COUNTRY_BACKGROUNDS = {
  US: {
    countryIso3: "USA",
    limitations: [
      "The U.S. Census Bureau measures Hispanic/Latino origin as a separate ethnicity question from race -- a person of any race can also identify as Hispanic or Latino, so that category isn't mutually exclusive with White/Black/Asian in the Race filter above.",
    ],
    categories: [
      { id: "us_hispanic_latino", displayName: "Hispanic or Latino origin", classificationType: "ethnicity", share: 0.19, harmonizedGroupId: "latin_american_hispanic", sourceName: "U.S. Census Bureau", sourceYear: 2020, sourceVariable: "Hispanic or Latino Origin", dataCoverageTier: "direct" },
      { id: "us_aian", displayName: "American Indian or Alaska Native", classificationType: "indigenous_identity", share: 0.011, harmonizedGroupId: "indigenous_peoples", sourceName: "U.S. Census Bureau", sourceYear: 2020, sourceVariable: "Race", dataCoverageTier: "direct" },
      { id: "us_nhpi", displayName: "Native Hawaiian or Other Pacific Islander", classificationType: "race", share: 0.003, harmonizedGroupId: "pacific_islander", sourceName: "U.S. Census Bureau", sourceYear: 2020, sourceVariable: "Race", dataCoverageTier: "direct" },
      { id: "us_two_or_more", displayName: "Two or more races", classificationType: "mixed_background", share: 0.10, harmonizedGroupId: "mixed_multiracial", sourceName: "U.S. Census Bureau", sourceYear: 2020, sourceVariable: "Race", dataCoverageTier: "direct" },
    ],
  },

  GB: {
    countryIso3: "GBR",
    limitations: [],
    categories: [
      { id: "gb_indian", displayName: "Indian", classificationType: "ethnicity", share: 0.031, harmonizedGroupId: "south_asian", sourceName: "UK Office for National Statistics (ONS)", sourceYear: 2021, sourceVariable: "Ethnic group, England and Wales", dataCoverageTier: "direct" },
      { id: "gb_pakistani", displayName: "Pakistani", classificationType: "ethnicity", share: 0.027, harmonizedGroupId: "south_asian", sourceName: "UK Office for National Statistics (ONS)", sourceYear: 2021, sourceVariable: "Ethnic group, England and Wales", dataCoverageTier: "direct" },
      { id: "gb_bangladeshi", displayName: "Bangladeshi", classificationType: "ethnicity", share: 0.010, harmonizedGroupId: "south_asian", sourceName: "UK Office for National Statistics (ONS)", sourceYear: 2021, sourceVariable: "Ethnic group, England and Wales", dataCoverageTier: "direct" },
      { id: "gb_chinese", displayName: "Chinese", classificationType: "ethnicity", share: 0.007, harmonizedGroupId: "east_asian", sourceName: "UK Office for National Statistics (ONS)", sourceYear: 2021, sourceVariable: "Ethnic group, England and Wales", dataCoverageTier: "direct" },
      { id: "gb_other_asian", displayName: "Other Asian background", classificationType: "ethnicity", share: 0.018, harmonizedGroupId: null, sourceName: "UK Office for National Statistics (ONS)", sourceYear: 2021, sourceVariable: "Ethnic group, England and Wales", dataCoverageTier: "direct" },
      { id: "gb_black", displayName: "Black, Black British, Caribbean or African", classificationType: "ethnicity", share: 0.040, harmonizedGroupId: "sub_saharan_african_ancestry", sourceName: "UK Office for National Statistics (ONS)", sourceYear: 2021, sourceVariable: "Ethnic group, England and Wales", dataCoverageTier: "direct" },
      { id: "gb_mixed", displayName: "Mixed or Multiple ethnic groups", classificationType: "mixed_background", share: 0.029, harmonizedGroupId: "mixed_multiracial", sourceName: "UK Office for National Statistics (ONS)", sourceYear: 2021, sourceVariable: "Ethnic group, England and Wales", dataCoverageTier: "direct" },
      { id: "gb_white", displayName: "White", classificationType: "race", share: 0.817, harmonizedGroupId: "european_ancestry", sourceName: "UK Office for National Statistics (ONS)", sourceYear: 2021, sourceVariable: "Ethnic group, England and Wales", dataCoverageTier: "direct" },
    ],
  },

  CA: {
    countryIso3: "CAN",
    limitations: [
      "Statistics Canada measures Indigenous identity (First Nations, Métis, Inuit) as a separate question from visible-minority status -- the two aren't mutually exclusive categories in the source data.",
    ],
    categories: [
      { id: "ca_south_asian", displayName: "South Asian", classificationType: "ethnicity", share: 0.071, harmonizedGroupId: "south_asian", sourceName: "Statistics Canada", sourceYear: 2021, sourceVariable: "Visible minority population, Census of Population", dataCoverageTier: "direct" },
      { id: "ca_chinese", displayName: "Chinese", classificationType: "ethnicity", share: 0.047, harmonizedGroupId: "east_asian", sourceName: "Statistics Canada", sourceYear: 2021, sourceVariable: "Visible minority population, Census of Population", dataCoverageTier: "direct" },
      { id: "ca_black", displayName: "Black", classificationType: "ethnicity", share: 0.043, harmonizedGroupId: "sub_saharan_african_ancestry", sourceName: "Statistics Canada", sourceYear: 2021, sourceVariable: "Visible minority population, Census of Population", dataCoverageTier: "direct" },
      { id: "ca_filipino", displayName: "Filipino", classificationType: "ethnicity", share: 0.024, harmonizedGroupId: "southeast_asian", sourceName: "Statistics Canada", sourceYear: 2021, sourceVariable: "Visible minority population, Census of Population", dataCoverageTier: "direct" },
      { id: "ca_arab", displayName: "Arab", classificationType: "ethnicity", share: 0.019, harmonizedGroupId: "middle_eastern_north_african", sourceName: "Statistics Canada", sourceYear: 2021, sourceVariable: "Visible minority population, Census of Population", dataCoverageTier: "direct" },
      { id: "ca_latin_american", displayName: "Latin American", classificationType: "ethnicity", share: 0.016, harmonizedGroupId: "latin_american_hispanic", sourceName: "Statistics Canada", sourceYear: 2021, sourceVariable: "Visible minority population, Census of Population", dataCoverageTier: "direct" },
      { id: "ca_southeast_asian", displayName: "Southeast Asian", classificationType: "ethnicity", share: 0.017, harmonizedGroupId: "southeast_asian", sourceName: "Statistics Canada", sourceYear: 2021, sourceVariable: "Visible minority population, Census of Population", dataCoverageTier: "direct" },
      { id: "ca_indigenous", displayName: "Indigenous identity (First Nations, Métis, Inuit)", classificationType: "indigenous_identity", share: 0.050, harmonizedGroupId: "indigenous_peoples", sourceName: "Statistics Canada", sourceYear: 2021, sourceVariable: "Indigenous identity, Census of Population", dataCoverageTier: "direct" },
    ],
  },

  AU: {
    countryIso3: "AUS",
    limitations: [
      "Australian Bureau of Statistics ancestry figures come from a multiple-response census question (respondents may report up to two ancestries), so shares reflect how many people report a background, not a mutually exclusive breakdown of the population.",
    ],
    categories: [
      { id: "au_indigenous", displayName: "Aboriginal and/or Torres Strait Islander", classificationType: "indigenous_identity", share: 0.032, harmonizedGroupId: "indigenous_peoples", sourceName: "Australian Bureau of Statistics (ABS)", sourceYear: 2021, sourceVariable: "Indigenous status, Census of Population and Housing", dataCoverageTier: "direct" },
      { id: "au_chinese_ancestry", displayName: "Chinese ancestry", classificationType: "ancestry", share: 0.055, harmonizedGroupId: "east_asian", sourceName: "Australian Bureau of Statistics (ABS)", sourceYear: 2021, sourceVariable: "Ancestry, Census of Population and Housing", dataCoverageTier: "direct" },
      { id: "au_indian_ancestry", displayName: "Indian ancestry", classificationType: "ancestry", share: 0.031, harmonizedGroupId: "south_asian", sourceName: "Australian Bureau of Statistics (ABS)", sourceYear: 2021, sourceVariable: "Ancestry, Census of Population and Housing", dataCoverageTier: "direct" },
    ],
  },

  NZ: {
    countryIso3: "NZL",
    limitations: [
      "Stats NZ measures ethnicity as a multiple-response question -- a person can report more than one ethnicity, so these shares add to more than 100% and aren't mutually exclusive.",
    ],
    categories: [
      { id: "nz_european", displayName: "European", classificationType: "ethnicity", share: 0.702, harmonizedGroupId: "european_ancestry", sourceName: "Stats NZ", sourceYear: 2018, sourceVariable: "Ethnic group, Census of Population and Dwellings", dataCoverageTier: "direct" },
      { id: "nz_maori", displayName: "Māori", classificationType: "indigenous_identity", share: 0.165, harmonizedGroupId: "indigenous_peoples", sourceName: "Stats NZ", sourceYear: 2018, sourceVariable: "Ethnic group, Census of Population and Dwellings", dataCoverageTier: "direct" },
      { id: "nz_pacific", displayName: "Pacific peoples", classificationType: "ethnicity", share: 0.081, harmonizedGroupId: "pacific_islander", sourceName: "Stats NZ", sourceYear: 2018, sourceVariable: "Ethnic group, Census of Population and Dwellings", dataCoverageTier: "direct" },
      { id: "nz_asian", displayName: "Asian", classificationType: "ethnicity", share: 0.151, harmonizedGroupId: null, sourceName: "Stats NZ", sourceYear: 2018, sourceVariable: "Ethnic group, Census of Population and Dwellings", dataCoverageTier: "direct" },
      { id: "nz_melaa", displayName: "Middle Eastern, Latin American or African", classificationType: "ethnicity", share: 0.015, harmonizedGroupId: "middle_eastern_north_african", sourceName: "Stats NZ", sourceYear: 2018, sourceVariable: "Ethnic group, Census of Population and Dwellings", dataCoverageTier: "direct" },
    ],
  },

  ZA: {
    countryIso3: "ZAF",
    limitations: [],
    categories: [
      { id: "za_black_african", displayName: "Black African", classificationType: "race", share: 0.81, harmonizedGroupId: "sub_saharan_african_ancestry", sourceName: "Statistics South Africa (Stats SA)", sourceYear: 2022, sourceVariable: "Population group", dataCoverageTier: "direct" },
      { id: "za_white", displayName: "White", classificationType: "race", share: 0.073, harmonizedGroupId: "european_ancestry", sourceName: "Statistics South Africa (Stats SA)", sourceYear: 2022, sourceVariable: "Population group", dataCoverageTier: "direct" },
      { id: "za_coloured", displayName: "Coloured", classificationType: "race", share: 0.088, harmonizedGroupId: "mixed_multiracial", sourceName: "Statistics South Africa (Stats SA)", sourceYear: 2022, sourceVariable: "Population group", dataCoverageTier: "direct", limitations: ["'Coloured' is Stats SA's own official term for a population group with a distinct mixed heritage, historically and legally recognized in South Africa -- it is not a term this site invented."] },
      { id: "za_indian_asian", displayName: "Indian or Asian", classificationType: "race", share: 0.026, harmonizedGroupId: "south_asian", sourceName: "Statistics South Africa (Stats SA)", sourceYear: 2022, sourceVariable: "Population group", dataCoverageTier: "direct" },
    ],
  },

  BR: {
    countryIso3: "BRA",
    limitations: [],
    categories: [
      { id: "br_branca", displayName: "Branca (White)", classificationType: "race", share: 0.43, harmonizedGroupId: "european_ancestry", sourceName: "Instituto Brasileiro de Geografia e Estatística (IBGE)", sourceYear: 2022, sourceVariable: "Cor ou raça (Color or race)", dataCoverageTier: "direct" },
      { id: "br_preta", displayName: "Preta (Black)", classificationType: "race", share: 0.10, harmonizedGroupId: "sub_saharan_african_ancestry", sourceName: "Instituto Brasileiro de Geografia e Estatística (IBGE)", sourceYear: 2022, sourceVariable: "Cor ou raça (Color or race)", dataCoverageTier: "direct" },
      { id: "br_parda", displayName: "Parda (Mixed/Brown)", classificationType: "mixed_background", share: 0.45, harmonizedGroupId: "mixed_multiracial", sourceName: "Instituto Brasileiro de Geografia e Estatística (IBGE)", sourceYear: 2022, sourceVariable: "Cor ou raça (Color or race)", dataCoverageTier: "direct", limitations: ["'Parda' is Brazil's own census category and its largest single group -- it is not a proxy or this site's approximation."] },
      { id: "br_amarela", displayName: "Amarela (East Asian descent)", classificationType: "race", share: 0.011, harmonizedGroupId: "east_asian", sourceName: "Instituto Brasileiro de Geografia e Estatística (IBGE)", sourceYear: 2022, sourceVariable: "Cor ou raça (Color or race)", dataCoverageTier: "direct" },
      { id: "br_indigena", displayName: "Indígena (Indigenous)", classificationType: "indigenous_identity", share: 0.006, harmonizedGroupId: "indigenous_peoples", sourceName: "Instituto Brasileiro de Geografia e Estatística (IBGE)", sourceYear: 2022, sourceVariable: "Cor ou raça (Color or race)", dataCoverageTier: "direct" },
    ],
  },
};

// Returns { supported, categories, limitations } for a country code. Any
// country not in COUNTRY_BACKGROUNDS above is honestly unsupported --
// never silently defaulted to some other country's categories.
function getBackgroundOptions(countryCode) {
  const entry = COUNTRY_BACKGROUNDS[countryCode];
  if (!entry) return { supported: false, categories: [], limitations: [] };
  return { supported: true, categories: entry.categories, limitations: entry.limitations || [] };
}

// "Broad Global Categories" mode: regroups a country's own real
// categories by harmonized bucket, summing their shares. Never invents
// a figure -- a category with no harmonizedGroupId simply doesn't
// appear in this view, and countries with no entry above return none.
function getHarmonizedOptions(countryCode) {
  const entry = COUNTRY_BACKGROUNDS[countryCode];
  if (!entry) return { supported: false, groups: [] };
  const totals = {};
  entry.categories.forEach((cat) => {
    if (!cat.harmonizedGroupId) return;
    if (!totals[cat.harmonizedGroupId]) totals[cat.harmonizedGroupId] = 0;
    totals[cat.harmonizedGroupId] += cat.share;
  });
  const groups = Object.keys(totals).map((id) => ({
    id,
    displayName: HARMONIZED_GROUPS[id] ? HARMONIZED_GROUPS[id].displayName : id,
    share: Math.min(1, totals[id]),
  }));
  return { supported: groups.length > 0, groups };
}

window.QuizEthnicity = { HARMONIZED_GROUPS, COUNTRY_BACKGROUNDS, getBackgroundOptions, getHarmonizedOptions };
})();
