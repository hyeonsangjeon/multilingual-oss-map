#!/usr/bin/env python3
"""
build_regions.py — generate site/data/lang-regions.json and site/data/iso-countries.json.

lang-regions.json is HAND-AUTHORED (not derived from the dataset): it maps a language to the
ISO 3166-1 alpha-3 countries where it is a de jure official/national or de facto majority language.
This is deliberately a *language usage* mapping, NOT "where repositories live" (see spec §3.1 and
docs/language-region-mapping.md). Every code is validated against pycountry so typos fail loudly.

iso-countries.json maps alpha-3 -> {numeric, name} so the D3/TopoJSON world map (whose feature ids
are ISO numeric codes) can be matched to our alpha-3 mappings and given readable hover labels.
"""
from __future__ import annotations
import json, sys
from pathlib import Path
import pycountry

OUT = Path(__file__).resolve().parent.parent / "site" / "data"

# Provenance note stored in the file itself.
NOTE = ("This is a language map, not a country map. Shaded regions mark where a language is "
        "commonly used (de jure official / de facto majority) \u2014 NOT where repositories are "
        "located. One language can span many countries (e.g. Spanish, Arabic, French). See "
        "docs/language-region-mapping.md for the method and its limits.")

# lang_code -> (country alpha-3 list, broad?, regional-only?, rationale)
# broad     = spans many countries; a single choropleth region under-represents it.
# regional  = primarily a sub-national / regional language with no dominant sovereign state; may be
#             mapped to a country where it is co-official, so it will usually be visually overridden
#             by that country's larger language (documented, honest).
REGIONS: dict[str, tuple[list[str], bool, bool, str]] = {
    "PT": (["BRA", "PRT", "AGO", "MOZ", "CPV", "GNB", "STP", "TLS"], True, False,
           "Official language of Brazil, Portugal and Lusophone Africa/Asia; Brazil dominates counts."),
    "ES": (["ESP", "MEX", "ARG", "COL", "PER", "VEN", "CHL", "ECU", "GTM", "CUB", "BOL", "DOM",
            "HND", "PRY", "SLV", "NIC", "CRI", "PAN", "URY", "GNQ"], True, False,
           "Official across Spain and most of Latin America plus Equatorial Guinea."),
    "FR": (["FRA", "BEL", "CHE", "LUX", "MCO", "CAN", "CIV", "SEN", "CMR", "COD", "COG", "MLI",
            "BFA", "NER", "TCD", "GIN", "BEN", "TGO", "GAB", "CAF", "MDG", "DJI", "RWA", "BDI",
            "HTI"], True, False,
           "Official in France plus much of West/Central Africa, parts of Canada, Belgium, Switzerland, Haiti."),
    "RU": (["RUS", "BLR", "KAZ", "KGZ"], True, False,
           "Official/co-official in Russia, Belarus, Kazakhstan, Kyrgyzstan; widely used across the CIS."),
    "AR": (["SAU", "EGY", "DZA", "IRQ", "MAR", "SDN", "SYR", "YEM", "TUN", "JOR", "LBY", "LBN",
            "PSE", "OMN", "KWT", "MRT", "QAT", "BHR", "ARE", "DJI", "COM"], True, False,
           "Official across the Arab world (Modern Standard Arabic); many national varieties."),
    "ZH": (["CHN", "TWN", "SGP"], True, False,
           "Written Chinese: China, Taiwan, Singapore (also Hong Kong/Macau, not separate map features)."),
    "DE": (["DEU", "AUT", "CHE", "LUX", "LIE"], False, False,
           "Official in Germany, Austria, and co-official in Switzerland, Luxembourg, Liechtenstein."),
    "NL": (["NLD", "BEL", "SUR"], False, False, "Dutch: Netherlands, Flanders (Belgium), Suriname."),
    "IT": (["ITA", "SMR", "VAT"], False, False, "Italian: Italy, San Marino, Vatican (also parts of Switzerland)."),
    "KO": (["KOR", "PRK"], False, False, "Korean: South and North Korea."),
    "JA": (["JPN"], False, False, "Japanese: Japan."),
    "ID": (["IDN"], False, False, "Indonesian: Indonesia."),
    "VI": (["VNM"], False, False, "Vietnamese: Vietnam."),
    "TR": (["TUR"], False, False, "Turkish: T\u00fcrkiye (also Northern Cyprus, not a map feature)."),
    "TH": (["THA"], False, False, "Thai: Thailand."),
    "PL": (["POL"], False, False, "Polish: Poland."),
    "UK": (["UKR"], False, False, "Ukrainian: Ukraine."),
    "CS": (["CZE"], False, False, "Czech: Czechia."),
    "SK": (["SVK"], False, False, "Slovak: Slovakia."),
    "HU": (["HUN"], False, False, "Hungarian: Hungary."),
    "RO": (["ROU", "MDA"], False, False, "Romanian: Romania and Moldova."),
    "FI": (["FIN"], False, False, "Finnish: Finland."),
    "SV": (["SWE"], False, False, "Swedish: Sweden (also co-official in Finland)."),
    "DA": (["DNK"], False, False, "Danish: Denmark (also Greenland, Faroe Islands)."),
    "NB": (["NOR"], False, False, "Norwegian Bokm\u00e5l: Norway."),
    "NO": (["NOR"], False, False, "Norwegian: Norway."),
    "NN": (["NOR"], False, False, "Norwegian Nynorsk: Norway."),
    "EL": (["GRC", "CYP"], False, False, "Greek: Greece and Cyprus."),
    "BG": (["BGR"], False, False, "Bulgarian: Bulgaria."),
    "SL": (["SVN"], False, False, "Slovenian: Slovenia."),
    "HR": (["HRV"], False, False, "Croatian: Croatia."),
    "SR": (["SRB"], False, False, "Serbian: Serbia."),
    "BS": (["BIH"], False, False, "Bosnian: Bosnia and Herzegovina."),
    "MK": (["MKD"], False, False, "Macedonian: North Macedonia."),
    "SQ": (["ALB", "XKX"], False, False, "Albanian: Albania and Kosovo."),
    "LT": (["LTU"], False, False, "Lithuanian: Lithuania."),
    "LV": (["LVA"], False, False, "Latvian: Latvia."),
    "ET": (["EST"], False, False, "Estonian: Estonia."),
    "HE": (["ISR"], False, False, "Hebrew: Israel."),
    "IW": (["ISR"], False, False, "Hebrew (legacy code IW): Israel."),
    "FA": (["IRN", "AFG", "TJK"], True, False, "Persian: Iran, Dari in Afghanistan, Tajik in Tajikistan."),
    "HI": (["IND"], False, False, "Hindi: India (one of many official languages)."),
    "BN": (["BGD", "IND"], False, False, "Bengali: Bangladesh and India (West Bengal)."),
    "TA": (["IND", "LKA", "SGP"], False, False, "Tamil: India (Tamil Nadu), Sri Lanka, Singapore."),
    "UR": (["PAK", "IND"], False, False, "Urdu: Pakistan and India."),
    "MR": (["IND"], False, True, "Marathi: regional language of Maharashtra, India."),
    "TE": (["IND"], False, True, "Telugu: regional language of Andhra Pradesh/Telangana, India."),
    "GU": (["IND"], False, True, "Gujarati: regional language of Gujarat, India."),
    "PA": (["IND", "PAK"], False, True, "Punjabi: Punjab region of India and Pakistan."),
    "NE": (["NPL"], False, False, "Nepali: Nepal."),
    "MY": (["MMR"], False, False, "Burmese: Myanmar."),
    "KM": (["KHM"], False, False, "Khmer: Cambodia."),
    "MS": (["MYS", "BRN"], False, False, "Malay: Malaysia and Brunei."),
    "TL": (["PHL"], False, False, "Tagalog/Filipino: Philippines."),
    "KA": (["GEO"], False, False, "Georgian: Georgia."),
    "HY": (["ARM"], False, False, "Armenian: Armenia."),
    "AZ": (["AZE"], False, False, "Azerbaijani: Azerbaijan."),
    "KK": (["KAZ"], False, False, "Kazakh: Kazakhstan."),
    "KY": (["KGZ"], False, False, "Kyrgyz: Kyrgyzstan."),
    "UZ": (["UZB"], False, False, "Uzbek: Uzbekistan."),
    "MN": (["MNG"], False, False, "Mongolian: Mongolia."),
    "IS": (["ISL"], False, False, "Icelandic: Iceland."),
    "GA": (["IRL"], False, False, "Irish: Ireland."),
    "CY": (["GBR"], False, True, "Welsh: Wales (United Kingdom)."),
    "EU": (["ESP"], False, True, "Basque: Basque Country / Navarre (Spain) and part of France."),
    "CA": (["AND"], False, True, "Catalan: sole official language of Andorra; also Catalonia/Valencia/Balearics (Spain)."),
    "GL": (["ESP"], False, True, "Galician: regional language of Galicia (Spain)."),
    "AF": (["ZAF", "NAM"], False, False, "Afrikaans: South Africa and Namibia."),
    "XH": (["ZAF"], False, True, "Xhosa: one of South Africa's official languages."),
    "ZU": (["ZAF"], False, True, "Zulu: one of South Africa's official languages."),
    "SN": (["ZWE"], False, False, "Shona: Zimbabwe."),
    "SO": (["SOM"], False, False, "Somali: Somalia."),
    "SW": (["TZA", "KEN", "UGA", "COD"], True, False, "Swahili: Tanzania, Kenya, Uganda, DR Congo."),
    "YO": (["NGA"], False, True, "Yoruba: southwestern Nigeria and Benin."),
    "HA": (["NGA", "NER"], False, True, "Hausa: northern Nigeria and Niger."),
    "JV": (["IDN"], False, True, "Javanese: Java, Indonesia."),
    "MI": (["NZL"], False, False, "M\u0101ori: New Zealand."),
    "LB": (["LUX"], False, False, "Luxembourgish: Luxembourg."),
    "CO": (["FRA"], False, True, "Corsican: Corsica (France)."),
    "OC": (["FRA"], False, True, "Occitan: southern France."),
    "FY": (["NLD"], False, True, "West Frisian: Friesland (Netherlands)."),
    "EO": ([], False, False, "Esperanto: constructed international language \u2014 no country."),
    "LA": ([], False, False, "Latin: historical/liturgical \u2014 no living national territory."),
}


def build() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    # validate + collect country codes actually used
    bad, used = [], set()
    for lang, (codes, *_rest) in REGIONS.items():
        for c in codes:
            if c == "XKX":  # Kosovo: user-assigned code, not in pycountry by default
                used.add(c); continue
            if pycountry.countries.get(alpha_3=c) is None:
                bad.append((lang, c))
            else:
                used.add(c)
    if bad:
        print("INVALID country codes:", bad); return 1

    regions = {}
    for lang, (codes, broad, regional, rationale) in sorted(REGIONS.items()):
        o = pycountry.languages.get(alpha_2=lang.lower()) or pycountry.languages.get(alpha_3=lang.lower())
        name = {"IW": "Hebrew"}.get(lang, getattr(o, "name", lang) if o else lang)
        regions[lang] = {"name": name, "countries": codes, "broad": broad,
                         "regional": regional, "rationale": rationale}
    payload = {"note": NOTE,
               "method": "Hand-authored language\u2192country mapping (official/majority use); "
                         "see docs/language-region-mapping.md.",
               "regions": regions}
    (OUT / "lang-regions.json").write_text(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")), "utf-8")

    # iso-countries: alpha3 -> {numeric, name} for ALL countries (map needs the full set)
    iso = {}
    for c in pycountry.countries:
        iso[c.alpha_3] = {"numeric": c.numeric, "name": getattr(c, "common_name", c.name)}
    iso["XKX"] = {"numeric": "983", "name": "Kosovo"}  # de-facto code used by world-atlas
    (OUT / "iso-countries.json").write_text(
        json.dumps(iso, ensure_ascii=False, sort_keys=True, separators=(",", ":")), "utf-8")

    print(f"lang-regions.json: {len(regions)} languages, {len(used)} distinct countries")
    print(f"iso-countries.json: {len(iso)} countries")
    return 0


if __name__ == "__main__":
    sys.exit(build())
