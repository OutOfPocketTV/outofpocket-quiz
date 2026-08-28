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
      "The U.S. Census Bureau measures Hispanic/Latino origin as a separate ethnicity question from race -- a person of any race can also identify as Hispanic or Latino. The Race filter above offers Hispanic alongside White, Black and Asian: White there is the not-Hispanic figure and so is cleanly exclusive, but Black and Asian are Hispanic-inclusive, so those two overlap Hispanic slightly.",
    ],
    categories: [
      {
        id: "us_hispanic_latino", displayName: "Hispanic or Latino origin", classificationType: "ethnicity", share: 0.19,
        harmonizedGroupId: "latin_american_hispanic", sourceName: "U.S. Census Bureau", sourceYear: 2020,
        sourceVariable: "Hispanic or Latino Origin", dataCoverageTier: "direct",
        // Share of the TOTAL US population that is both the given race and
        // Hispanic/Latino, from the 2020 Census Redistricting Data (P.L.
        // 94-171) Supplementary Tables on Race and Hispanic Origin -- used
        // to combine this category with the Race filter above (see
        // computeRaceBackgroundCombination() in script.js) without either
        // double-counting or assuming independence.
        //   black: 1,163,862 people (~0.4% of total population, 1.9% of the
        //     Hispanic population).
        //   asian: 267,330 people (~0.08% of total population).
        //   white: 0 is NOT "no data" -- stats.js's raceShare.white (and
        //     states.js's per-state white share) is Census White-alone
        //     NON-Hispanic by this app's own documented convention
        //     (states.js top-of-file comment), unlike black/asian which use
        //     Hispanic-inclusive "alone" figures. The White bucket already
        //     excludes Hispanics by construction, so the true overlap for
        //     THIS app's category definitions is 0 -- the raw Census
        //     White-alone-and-Hispanic figure (12,579,626 people, ~3.8% of
        //     total population) does NOT apply here and must not be used.
        //   hispanic: this category and the Race filter's own Hispanic
        //     option describe the same people, so the overlap is the
        //     whole category -- a structural fact like us_aian's zeros
        //     below, not an imported cross-tab. Without it, selecting
        //     both would multiply 0.19 by 0.19 and under-report 5x.
        raceOverlap: { white: 0, black: 0.004, asian: 0.0008, hispanic: 0.19 },
      },
      {
        id: "us_aian", displayName: "American Indian or Alaska Native", classificationType: "indigenous_identity", share: 0.011,
        harmonizedGroupId: "indigenous_peoples", sourceName: "U.S. Census Bureau", sourceYear: 2020,
        sourceVariable: "Race", dataCoverageTier: "direct",
        // Same Census race question as White/Black/Asian (a single-select
        // "alone" category), so mutually exclusive with all three by
        // definition -- 0 here is a structural fact, not an empirical
        // import from a cross-tab.
        raceOverlap: { white: 0, black: 0, asian: 0 },
      },
      {
        id: "us_nhpi", displayName: "Native Hawaiian or Other Pacific Islander", classificationType: "race", share: 0.003,
        harmonizedGroupId: "pacific_islander", sourceName: "U.S. Census Bureau", sourceYear: 2020,
        sourceVariable: "Race", dataCoverageTier: "direct",
        // Same Census race question as White/Black/Asian -- mutually
        // exclusive by definition, same as us_aian above.
        raceOverlap: { white: 0, black: 0, asian: 0 },
      },
      {
        id: "us_two_or_more", displayName: "Two or more races", classificationType: "mixed_background", share: 0.10,
        harmonizedGroupId: "mixed_multiracial", sourceName: "U.S. Census Bureau", sourceYear: 2020,
        sourceVariable: "Race", dataCoverageTier: "direct",
        // Same Census race question as White/Black/Asian -- "two or more
        // races" is itself defined as not being any single "alone"
        // category, so mutually exclusive with all three by definition.
        raceOverlap: { white: 0, black: 0, asian: 0 },
      },
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

  SG: {
    countryIso3: "SGP",
    limitations: [],
    categories: [
      { id: "sg_chinese", displayName: "Chinese", classificationType: "ethnicity", share: 0.743, harmonizedGroupId: "east_asian", sourceName: "Singapore Department of Statistics", sourceYear: 2020, sourceVariable: "Resident population by ethnic group (CMIO), Census of Population", dataCoverageTier: "direct" },
      { id: "sg_malay", displayName: "Malay", classificationType: "ethnicity", share: 0.135, harmonizedGroupId: "southeast_asian", sourceName: "Singapore Department of Statistics", sourceYear: 2020, sourceVariable: "Resident population by ethnic group (CMIO), Census of Population", dataCoverageTier: "direct" },
      { id: "sg_indian", displayName: "Indian", classificationType: "ethnicity", share: 0.090, harmonizedGroupId: "south_asian", sourceName: "Singapore Department of Statistics", sourceYear: 2020, sourceVariable: "Resident population by ethnic group (CMIO), Census of Population", dataCoverageTier: "direct" },
      { id: "sg_other", displayName: "Other", classificationType: "ethnicity", share: 0.032, harmonizedGroupId: null, sourceName: "Singapore Department of Statistics", sourceYear: 2020, sourceVariable: "Resident population by ethnic group (CMIO), Census of Population", dataCoverageTier: "direct", limitations: ["Singapore's official 'CMIO' framework (Chinese, Malay, Indian, Other) is its own long-standing census classification, not a category this site invented."] },
    ],
  },

  MY: {
    countryIso3: "MYS",
    limitations: [
      "'Bumiputera' is Malaysia's own official census category -- it includes ethnic Malays plus other indigenous groups (e.g. Iban, Kadazan-Dusun in Sabah/Sarawak), not just one ethnicity.",
    ],
    categories: [
      { id: "my_bumiputera", displayName: "Bumiputera (Malay & Indigenous)", classificationType: "ethnicity", share: 0.694, harmonizedGroupId: "southeast_asian", sourceName: "Department of Statistics Malaysia", sourceYear: 2020, sourceVariable: "Population by ethnic group, Census of Population and Housing", dataCoverageTier: "direct" },
      { id: "my_chinese", displayName: "Chinese", classificationType: "ethnicity", share: 0.226, harmonizedGroupId: "east_asian", sourceName: "Department of Statistics Malaysia", sourceYear: 2020, sourceVariable: "Population by ethnic group, Census of Population and Housing", dataCoverageTier: "direct" },
      { id: "my_indian", displayName: "Indian", classificationType: "ethnicity", share: 0.067, harmonizedGroupId: "south_asian", sourceName: "Department of Statistics Malaysia", sourceYear: 2020, sourceVariable: "Population by ethnic group, Census of Population and Housing", dataCoverageTier: "direct" },
      { id: "my_other", displayName: "Other", classificationType: "ethnicity", share: 0.013, harmonizedGroupId: null, sourceName: "Department of Statistics Malaysia", sourceYear: 2020, sourceVariable: "Population by ethnic group, Census of Population and Housing", dataCoverageTier: "direct" },
    ],
  },

  FJ: {
    countryIso3: "FJI",
    limitations: [],
    categories: [
      { id: "fj_itaukei", displayName: "iTaukei (Indigenous Fijian)", classificationType: "indigenous_identity", share: 0.570, harmonizedGroupId: "pacific_islander", sourceName: "Fiji Bureau of Statistics", sourceYear: 2017, sourceVariable: "Ethnicity, Census of Population and Housing", dataCoverageTier: "direct" },
      { id: "fj_indo_fijian", displayName: "Fijian of Indian descent", classificationType: "ethnicity", share: 0.375, harmonizedGroupId: "south_asian", sourceName: "Fiji Bureau of Statistics", sourceYear: 2017, sourceVariable: "Ethnicity, Census of Population and Housing", dataCoverageTier: "direct" },
      { id: "fj_rotuman", displayName: "Rotuman", classificationType: "ethnicity", share: 0.012, harmonizedGroupId: "pacific_islander", sourceName: "Fiji Bureau of Statistics", sourceYear: 2017, sourceVariable: "Ethnicity, Census of Population and Housing", dataCoverageTier: "direct" },
      { id: "fj_other", displayName: "Other", classificationType: "ethnicity", share: 0.043, harmonizedGroupId: null, sourceName: "Fiji Bureau of Statistics", sourceYear: 2017, sourceVariable: "Ethnicity, Census of Population and Housing", dataCoverageTier: "direct" },
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
  // Sums raceOverlap alongside share, same rule: only if EVERY category
  // feeding a harmonized group has raceOverlap data does the group get an
  // aggregated raceOverlap -- one category missing it means the group's
  // true overlap is genuinely unknown, not zero, so it stays undefined
  // rather than silently understating it (see computeRaceBackgroundCombination
  // in script.js, which treats undefined raceOverlap as "OR mode unavailable").
  // Completeness is tracked per race, not per category. A category can
  // legitimately carry overlap for some races and not others -- every US
  // category has white/black/asian, but only us_hispanic_latino has a
  // hispanic figure, because Hispanic origin is a separate Census
  // question rather than another "alone" race bucket. Summing a race
  // blindly would understate a group whose categories disagree; ignoring
  // one entirely (this used to hardcode white/black/asian) silently
  // dropped hispanic from every broad group, which sent Race=Hispanic
  // plus the broad "Latin American / Hispanic origin" category down the
  // independence-product fallback and under-reported it 5x -- the exact
  // failure raceOverlap.hispanic was added to prevent.
  const OVERLAP_RACES = ["white", "black", "asian", "hispanic"];
  const overlapTotals = {};
  const overlapComplete = {};
  entry.categories.forEach((cat) => {
    if (!cat.harmonizedGroupId) return;
    const id = cat.harmonizedGroupId;
    if (!totals[id]) totals[id] = 0;
    totals[id] += cat.share;
    if (!overlapTotals[id]) {
      overlapTotals[id] = {};
      overlapComplete[id] = {};
      OVERLAP_RACES.forEach((race) => {
        overlapTotals[id][race] = 0;
        overlapComplete[id][race] = true;
      });
    }
    OVERLAP_RACES.forEach((race) => {
      if (!cat.raceOverlap || cat.raceOverlap[race] === undefined) {
        overlapComplete[id][race] = false;
        return;
      }
      overlapTotals[id][race] += cat.raceOverlap[race];
    });
  });
  const groups = Object.keys(totals).map((id) => {
    // Only the races that survived the completeness check appear as keys;
    // a race that didn't stays absent rather than present-as-zero, because
    // computeRaceBackgroundResult() in script.js reads a missing key as
    // "no real data, fall back" and a zero as a measured empty overlap.
    const overlap = {};
    let anyComplete = false;
    OVERLAP_RACES.forEach((race) => {
      if (!overlapComplete[id] || !overlapComplete[id][race]) return;
      overlap[race] = overlapTotals[id][race];
      anyComplete = true;
    });
    return {
      id,
      displayName: HARMONIZED_GROUPS[id] ? HARMONIZED_GROUPS[id].displayName : id,
      share: Math.min(1, totals[id]),
      raceOverlap: anyComplete ? overlap : undefined,
    };
  });
  return { supported: groups.length > 0, groups };
}

window.QuizEthnicity = { HARMONIZED_GROUPS, COUNTRY_BACKGROUNDS, getBackgroundOptions, getHarmonizedOptions };
})();
