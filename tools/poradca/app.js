/* ==========================================================================
   Svetelný poradca – "What light do I need?"
   Emília Schmidtová · 2026

   How it works, in plain words:
   1. The customer answers 4 questions (room, size, mood, what they already have).
   2. We look up how much light that room needs (in lux – light falling on 1 m²)
      and turn it into lumens (how much light the bulbs must give out).
   3. We pick matching products from the real LEDAKCIA catalogue, count how many
      pieces are needed and compare electricity cost with old light bulbs.
   Everything runs in the browser – no server, no AI, no API key.
   ========================================================================== */
'use strict';

/* --------------------------------------------------------------------------
   1. ASSUMPTIONS – every number the maths uses, in one place
   -------------------------------------------------------------------------- */
const ASSUME = {
  utilisation: 0.8,        // ~80 % of the light ends up where we need it indoors
  utilisationOutdoor: 0.6, // outside nothing reflects light back (no walls, no ceiling)
  refCeiling: 2.7,         // up to this ceiling height (m) we use the full 0.8
  minUtilisation: 0.55,    // never go below this, even with very high ceilings
  hoursPerDay: 3,          // typical evening use
  eurPerKWh: 0.20,         // electricity price
  incandescentLmPerW: 12,  // an old light bulb gives ~12 lumens per watt
  ledLmPerWEstimate: 80,   // if a product has no lumens in its data we estimate
                           // conservatively (the 20 W sensor floodlight in the same
                           // catalogue gives 1600 lm = 80 lm/W)
};

/* --------------------------------------------------------------------------
   2. ROOMS – light targets per room and mood
   lux: cozy / everyday / bright, based on common recommendations for homes
   (EN 12464-1 for work areas). kelvin: recommended colour temperature.
   -------------------------------------------------------------------------- */
const ROOMS = {
  living:   { lux: { cozy: 100, everyday: 150, bright: 200 }, range: '100–200', kelvin: { cozy: 2700, everyday: 2700, bright: 3000 }, ip: 20, size: [5, 4],   presets: [[4, 2.5], [4, 4], [5, 5], [7, 5]] },
  bedroom:  { lux: { cozy: 75,  everyday: 100, bright: 150 }, range: '75–150',  kelvin: { cozy: 2700, everyday: 2700, bright: 3000 }, ip: 20, size: [4, 3.5], presets: [[4, 2.5], [4, 3.5], [5, 4]] },
  kitchen:  { lux: { cozy: 200, everyday: 300, bright: 500 }, range: '300–500', kelvin: { cozy: 3000, everyday: 4000, bright: 4000 }, ip: 20, size: [4, 3],   presets: [[3, 2.5], [4, 3], [5, 4]] },
  bathroom: { lux: { cozy: 150, everyday: 200, bright: 300 }, range: '200–300', kelvin: { cozy: 3000, everyday: 3000, bright: 4000 }, ip: 44, size: [2.5, 2], presets: [[2, 2], [3, 2], [3, 3]] },
  kids:     { lux: { cozy: 100, everyday: 150, bright: 300 }, range: '100–300', kelvin: { cozy: 2700, everyday: 3000, bright: 4000 }, ip: 20, size: [4, 3],   presets: [[3.5, 3], [4, 3.5], [5, 4]] },
  office:   { lux: { cozy: 300, everyday: 400, bright: 500 }, range: '300–500', kelvin: { cozy: 3000, everyday: 4000, bright: 4000 }, ip: 20, size: [4, 3],   presets: [[3, 2.5], [4, 3], [6, 5]] },
  hallway:  { lux: { cozy: 50,  everyday: 100, bright: 150 }, range: '50–150',  kelvin: { cozy: 3000, everyday: 3000, bright: 4000 }, ip: 20, size: [4, 1.5], presets: [[4, 1], [5, 1.5], [4, 3]] },
  garage:   { lux: { cozy: 200, everyday: 300, bright: 500 }, range: '300–500', kelvin: { cozy: 4000, everyday: 4000, bright: 6000 }, ip: 65, size: [6, 3.5], presets: [[4, 3], [6, 3], [6, 6]] },
  garden:   { lux: { cozy: 10,  everyday: 20,  bright: 50  }, range: '10–50',   kelvin: { cozy: 2700, everyday: 3000, bright: 4000 }, ip: 65, size: [8, 6],   presets: [[10, 1], [4, 3], [10, 5]], outdoor: true },
  entrance: { lux: { cozy: 20,  everyday: 30,  bright: 50  }, range: '20–50',   kelvin: { cozy: 3000, everyday: 3000, bright: 4000 }, ip: 65, size: [3, 2],   presets: [[2, 2], [5, 3], [6, 5]], outdoor: true },
};
const ROOM_ORDER = Object.keys(ROOMS);
const MOODS = ['cozy', 'everyday', 'bright'];
const FITTINGS = ['e27', 'e14', 'gu10', 'ceiling', 'none'];

/* --------------------------------------------------------------------------
   3. PRODUCT FACTS – things written in the product descriptions that the
   automatic data import did not catch. Only facts from the product's own
   text on ledakcia.sk – nothing invented.
   -------------------------------------------------------------------------- */
const PRODUCT_FACTS = {
  '217603': { pack: 2, kelvinNote: 'k_switch' },     // "Cena je za 2 kusy", switch 3000/4000/6400 K
  '458':    { pack: 2 },                             // "Cena je za 2 kusy!"
  '8558':   { pack: 2 },                             // 1+1 zadarmo
  '8689':   { pack: 4 },                             // "balenie 4ks"
  '16190':  { pack: 2 },                             // "2x 5W … 2ks v blistri"
  '6387':   { watts: 36, kelvinNote: 'k_6387' },     // 2 × 18 W tubes; 4000 K or 6400 K variant
  '7173':   { kelvinNote: 'k_7173' },                // 3000 / 4500 / 6000 K variants
  '437':    { kelvinNote: 'k_437' },                 // 3000 / 4000 / 6400 K variants
  '16004':  { kelvinNote: 'k_16004' },               // 3 colours 3000–6000 K
  '12306':  { bulbsPer: 2 },                         // 2× E27 socket, bulbs not included
};

/* --------------------------------------------------------------------------
   4. TEXTS – Slovak first, English second. Every string of the UI lives here.
   -------------------------------------------------------------------------- */
const I18N = {
  sk: {
    back: '← <b>Portfólio Emílie Schmidtovej</b>',
    eyebrow: 'Interaktívny nástroj · LEDAKCIA',
    title: 'Svetelný poradca',
    pitch: 'Štyri jednoduché otázky a viete, koľko svetla potrebujete, akej farby a ktoré konkrétne svietidlá kúpiť.',
    story: 'Najčastejšia otázka v našej predajni aj v e-mailoch znie: „Aké svetlo potrebujem do izby?“ Ľudia nemusia rozumieť lúmenom, kelvinom ani IP krytiu – chcú vedieť, čo si majú kúpiť. Tento poradca odpovedá tak, ako by som odpovedala ja pri pulte.',
    storyBy: '— Emília, predajňa LEDAKCIA Bratislava',
    credit: 'Vytvorila Emília Schmidtová · 2026',
    back_step: 'Späť',
    step: 'Krok {n} zo {total}',

    q_room: 'Ktorý priestor idete osvetliť?',
    q_room_sub: 'Vyberte jednu možnosť.',
    q_size: 'Aký je veľký?',
    q_size_sub: 'Stačí odhad – vyberte predvoľbu alebo potiahnite posuvníky.',
    q_mood: 'Aké svetlo tam chcete?',
    q_mood_sub: 'Podľa toho, čo tam najčastejšie robíte.',
    q_cons: 'Ešte dve praktické veci',
    q_cons_sub: 'Aby sme vybrali produkty, ktoré naozaj pasujú.',

    room_living: 'Obývačka', room_living_hint: 'gauč, TV, návštevy',
    room_bedroom: 'Spálňa', room_bedroom_hint: 'oddych a spánok',
    room_kitchen: 'Kuchyňa', room_kitchen_hint: 'varenie, linka',
    room_bathroom: 'Kúpeľňa', room_bathroom_hint: 'vlhko, zrkadlo',
    room_kids: 'Detská izba', room_kids_hint: 'hra aj úlohy',
    room_office: 'Pracovňa', room_office_hint: 'kancelária, home office',
    room_hallway: 'Chodba', room_hallway_hint: 'predsieň, schodisko',
    room_garage: 'Garáž / dielňa', room_garage_hint: 'auto, náradie',
    room_garden: 'Záhrada / terasa', room_garden_hint: 'chodník, posedenie',
    room_entrance: 'Vchod / stena domu', room_entrance_hint: 'dvere, dvor',

    length: 'Dĺžka', width: 'Šírka', height: 'Výška stropu',
    area: 'Plocha', next: 'Ďalej', show_result: 'Zobraziť výsledok',
    preset_living: ['malá', 'stredná', 'veľká', 'open space'],
    preset_bedroom: ['malá', 'stredná', 'veľká'],
    preset_kitchen: ['malá', 'stredná', 'veľká'],
    preset_bathroom: ['malá', 'stredná', 'veľká'],
    preset_kids: ['malá', 'stredná', 'veľká'],
    preset_office: ['malá', 'stredná', 'kancelária'],
    preset_hallway: ['úzka', 'dlhšia', 'predsieň'],
    preset_garage: ['dielňa', '1 auto', '2 autá'],
    preset_garden: ['chodník', 'terasa', 'záhrada'],
    preset_entrance: ['vchod', 'pred garážou', 'dvor'],
    outdoor_size_note: 'Vonku zadajte plochu, ktorú chcete reálne osvetliť (chodník, terasu, priestor pred dverami) – nie celý pozemok.',

    mood_cozy: 'Útulne', mood_cozy_hint: 'večery, relax, pokoj',
    mood_everyday: 'Bežne', mood_everyday_hint: 'všetkého trochu',
    mood_bright: 'Jasne', mood_bright_hint: 'práca, varenie, detaily',
    mood_out_cozy: 'Atmosféra', mood_out_cozy_hint: 'jemné svetlo, dekor',
    mood_out_everyday: 'Orientácia', mood_out_everyday_hint: 'vidieť chodník a schody',
    mood_out_bright: 'Bezpečnosť', mood_out_bright_hint: 'jasno, keď niekto príde',

    q_fit: 'Čo tam už máte?',
    fit_e27: 'Objímka E27', fit_e27_hint: 'hrubý závit',
    fit_e14: 'Objímka E14', fit_e14_hint: 'úzky závit',
    fit_gu10: 'Bodovky GU10', fit_gu10_hint: 'zapustené spoty',
    fit_ceiling: 'Stropné svietidlo', fit_ceiling_hint: 'chcem ho vymeniť',
    fit_none: 'Nič / neviem', fit_none_hint: 'začínam od nuly',
    q_smart: 'Chcete svetlo ovládať z mobilu?',
    smart_yes: 'Áno, smart', smart_yes_hint: 'aplikácia, hlas',
    smart_no: 'Stačí vypínač', smart_no_hint: 'jednoducho',
    q_power: 'Je na mieste elektrina?',
    power_yes: 'Áno', power_yes_hint: 'zásuvka / kábel',
    power_no: 'Nie', power_no_hint: 'chcem solárne',
    q_motion: 'Má svetlo reagovať na pohyb?',
    motion_yes: 'Áno', motion_yes_hint: 'zapne sa samo',
    motion_no: 'Nie', motion_no_hint: 'svieti, keď chcem',

    r_eyebrow: 'Váš výsledok',
    r_title: '{room} · {area} m² · {mood}',
    r_edit: 'Upraviť odpovede',
    r_preview: 'Takto bude miestnosť pôsobiť',
    r_switch_on: 'Zapnuté', r_switch_off: 'Vypnuté',
    r_try_k: 'Vyskúšajte inú farbu svetla',
    r_reset_k: 'späť na odporúčanie',
    r_lumens: 'Potrebné svetlo',
    r_lumens_eq: '≈ {w} W klasických žiaroviek',
    r_lux_line: 'cieľ {lux} lx (odporúčanie {range} lx)',
    r_why: 'Prečo práve toľko?',
    r_why_formula: '{lux} lx × {area} m² ÷ {util} = {lm} lm',
    r_why_text: 'Lux hovorí, koľko svetla dopadne na 1 m², lúmeny, koľko ho vydajú žiarovky. Časť svetla sa „stratí“ na stenách a strope, preto delíme využitím {util}.',
    r_why_high: ' Pri strope {h} m je využitie nižšie – svetlo musí prejsť dlhšiu cestu.',
    r_why_out: ' Vonku sa svetlo nemá od čoho odraziť, preto počítame s využitím iba {util}.',
    r_kelvin: 'Farba svetla',
    k_warm: 'teplá biela', k_neutral: 'neutrálna biela', k_cool: 'studená / denná',
    k_desc_2700: 'Ako klasická žiarovka – útulné, žltkasté svetlo na večery.',
    k_desc_3000: 'Teplé, ale o niečo čistejšie. Univerzálne do domácnosti.',
    k_desc_4000: 'Neutrálne biele svetlo – verné farby, sústredenie, práca.',
    k_desc_6000: 'Chladné denné svetlo – maximum detailov, dielňa, garáž.',
    r_ip: 'Krytie (IP)',
    ip_20: 'Suchý interiér – stačí bežné svietidlo (IP20).',
    ip_44: 'V zóne pri vani a sprche aspoň IP44, priamo vo vani/sprche IP65 až IP67. Platí pre celé svietidlo, nie pre žiarovku.',
    ip_65_garage: 'V suchej garáži stačí IP20, v prašnej dielni alebo nevykurovanej garáži odporúčam IP65.',
    ip_65_out: 'Vonku na daždi IP65 (prachotesné, odolné voči striekajúcej vode). Pod strechou minimálne IP44.',
    ip_hint: 'Prvé číslo = ochrana pred prachom, druhé = pred vodou.',

    r_products: 'Čo by som vám odporučila',
    r_products_sub: 'Konkrétne produkty z ponuky LEDAKCIA, prepočítané na vašu miestnosť.',
    role_bulbs: 'Žiarovky do vašich objímok',
    role_main: 'Hlavné svetlo',
    role_pendant: 'Druhá vrstva: dizajnové závesné svietidlo',
    role_tv: 'Podsvietenie za TV',
    role_bedside: 'Lampička k posteli',
    role_undercab: 'Svetlo pod horné skrinky',
    role_night: 'Nočné svetielko pri dverách alebo umývadle',
    role_desk: 'Lampa na stôl',
    role_kidslamp: 'Detská lampička',
    role_neon: 'Nočné dekoratívne svetlo',
    role_motionstrip: 'Svetlo so senzorom pohybu',
    role_decor: 'Atmosféra pri chodníku',
    role_step: 'Svetlo k dverám so senzorom',
    role_smart: 'Smart ovládanie',
    with_bulb: '+ žiarovka: {name}',
    qty_pieces: '{n} ks', qty_piece: '1 ks',
    qty_packs: '{packs} × balenie ({n} ks)',
    qty_spare: '{spare} ks navyše v balení',
    gives_lm: 'spolu {lm} lm',
    lm_approx: 'cca',
    spec_lm: '{v} lm', spec_w: '{v} W', spec_k: '{v} K', spec_ip: 'IP{v}',
    spec_k_unknown: 'teplotu svetla overte na e-shope',
    spec_ip_unknown: 'IP v dátach neuvedené – overte',
    k_switch: 'prepínateľné 3000 / 4000 / 6400 K',
    k_6387: 'varianty 4000 K alebo 6400 K',
    k_7173: 'varianty 3000 / 4500 / 6000 K',
    k_437: 'varianty 3000 / 4000 / 6400 K',
    k_16004: 'voľba 3000–6000 K',
    price_each: 'za kus', price_pack: 'za balenie {pack} ks',
    view_product: 'Pozrieť na ledakcia.sk',
    votes: '{n} hodnotení',
    not_counted: 'Doplnky nie sú započítané v lúmenoch – sú to „vrstvy“ navyše pre atmosféru alebo pohodlie.',
    catalog_error: 'Katalóg produktov sa nepodarilo načítať. Čísla vyššie platia – produkty nájdete na ledakcia.sk.',

    r_total: 'Spolu za nákup',
    r_energy: 'Elektrina za rok',
    r_energy_led: 'LED (návrh)',
    r_energy_old: 'Klasické žiarovky',
    r_saving: 'Ušetríte cca {eur} ročne',
    r_payback: 'Hlavné svetlo sa zaplatí z úspor za cca {m}.',
    months: ['mesiac', 'mesiace', 'mesiacov'],
    r_energy_note: 'Hlavné svetlo, {h} h denne, {price} €/kWh. Klasická žiarovka ≈ 12 lm/W.',
    r_solar: 'Napája ho slnko',
    r_solar_note: 'Solárne svietidlá elektrinu zo siete nepotrebujú – 0 € ročne.',

    note_sockets: 'Počet kusov rozdeľte medzi svoje objímky. Ak máte menej objímok, zvoľte silnejšiu žiarovku alebo pridajte lampu.',
    note_bath_fixture: 'Žiarovky dávajte iba do svietidla s krytím aspoň IP44 – IP rieši teleso svietidla, nie žiarovka.',
    note_bath_6387: 'V ukážkovom katalógu je toto jediné stropné svietidlo s IP65. Pôsobí skôr technicky – ak chcete dizajnovejšie kúpeľňové svietidlo, poradíme vám v predajni.',
    note_solar: 'Solárne reflektory majú diaľkové ovládanie, stmievanie a časovač (3, 5 alebo 8 h). Panel dajte tam, kde cez deň svieti slnko – nabitie trvá 6–7 hodín.',
    note_solar_nomotion: 'Solárne reflektory v katalógu nemajú pohybový senzor – namiesto neho použite časovač.',
    note_garden_power: 'Aj keď máte elektrinu, solárne reflektory ušetria ťahanie káblov po záhrade.',
    note_sensor_manual: 'Reflektory so senzorom majú podľa popisu aj funkciu ručného prerušenia, takže nemusia reagovať len na pohyb.',
    note_panel_builtin: 'Vstavané panely sa montujú do podhľadu; prisadené uchytenie má panel 742.',
    note_smart: 'Smart modul sa montuje za existujúci vypínač (zapojenie nechajte na elektrikára). Ovládate ho v aplikácii eWeLink, funguje aj s Google Home a Amazon Alexa.',

    tip_title: 'Tip od Emílie',
    tip_living: 'Do obývačky nikdy nedávajte len jedno svetlo uprostred stropu. Skombinujte hlavné svetlo, lampu pri gauči a niečo dekoratívne – tomu hovoríme vrstvenie. Večer potom zhasnete strop a izba je hneď útulnejšia. Teplá biela 2700 K je tu takmer vždy správna voľba.',
    tip_bedroom: 'Spálňa je na oddych, nie na výsluch 🙂 Teplých 2700 K a radšej menej svetla z viacerých miest. Pri posteli sa oplatí lampička, ktorú zapnete bez vstávania, a hodinu pred spaním si svetlo stlmte – telu to pomáha spomaliť.',
    tip_kitchen: 'V kuchyni robíme najčastejšiu chybu: svetlo je len na strope za vami, takže pri krájaní si tienite vlastným telom. Pod horné skrinky dajte lištu – pracovná doska bude svetlá a neutrálna 4000 K ukáže farbu jedla verne.',
    tip_bathroom: 'Pri zrkadle hľadajte vysoké CRI (index podania farieb, ideálne 90 a viac), aby make-up či holenie vyzerali rovnako ako vonku. A IP krytie nie je kozmetika – nad vaňou a sprchou musí mať svietidlo aspoň IP44.',
    tip_kids: 'V detskej izbe myslite na dva režimy: jasné svetlo na hranie a úlohy a jemné nočné svetielko, pri ktorom sa dieťa nebojí. Lampičky nech sú stabilné a so zakrytou žiarovkou – malé ruky sú zvedavé.',
    tip_office: 'Na prácu je ideál 500 lx na stole a neutrálna 4000 K – hlava ostáva bdelá. Lampu dajte z boku (pravákom zľava), aby ste si netienili rukou, a monitor neotáčajte oproti oknu. Oslnenie unaví oči rýchlejšie než čokoľvek iné.',
    tip_hallway: 'Chodbou každý len prechádza – ideálne miesto pre pohybový senzor. Svetlo sa zapne samo, keď prídete s nákupom v rukách, a nikto nezabudne zhasnúť. Stačí menej svetla, ale bez tmavých kútov pri dverách a schodoch.',
    tip_garage: 'V garáži a dielni sa na svetle neoplatí šetriť – pri práci s náradím je jasné a rovnomerné svetlo otázkou bezpečnosti. Prach a vlhkosť zvládne svietidlo s IP65 a studenšia biela vám ukáže každý detail.',
    tip_garden: 'Záhradu neosvetľujte ako parkovisko. Menej je viac: zvýraznite chodník, schody a jeden pekný strom, zvyšok nechajte v šere. Solárne svietidlá dajte tam, kam cez deň svieti slnko aspoň pár hodín, inak večer nevydržia.',
    tip_entrance: 'Pri vchode ide hlavne o bezpečie: vidieť kľúčovú dierku, schodík a toho, kto stojí pri dverách. Pohybový senzor je tu najlepší kamarát – nesvieti zbytočne celú noc a zároveň odradí nevítaných hostí.',

    btn_restart: 'Začať odznova',
    btn_share: 'Zdieľať výsledok',
    btn_print: 'Vytlačiť',
    copied: 'Zhrnutie je skopírované – stačí ho vložiť do správy.',
    copy_fail: 'Kopírovanie sa nepodarilo – označte text ručne.',
    disclaimer: 'Výpočet je orientačný a zámerne skôr štedrejší. Ceny pochádzajú z katalógu LEDAKCIA – aktuálnu cenu a dostupnosť overte na ledakcia.sk.',
    share_head: 'Svetelný poradca – {room}, {area} m², {mood}',
    share_lm: 'Potrebné svetlo: {lm} lm (cieľ {lux} lx)',
    share_k: 'Farba svetla: {k} K ({name})',
    share_ip: 'Krytie: IP{ip}',
    share_total: 'Spolu: {total}',
    share_saving: 'Úspora oproti klasickým žiarovkám: cca {eur} ročne',
    share_link: 'Výsledok: {url}',
  },

  en: {
    back: '← <b>Emília Schmidtová’s portfolio</b>',
    eyebrow: 'Interactive tool · LEDAKCIA',
    title: 'Lighting advisor',
    pitch: 'Four simple questions and you know how much light you need, what colour, and which products to buy.',
    story: 'The most common question in our store and inbox is: “What light do I need for my room?” People don’t need to understand lumens, Kelvin or IP ratings – they want to know what to buy. This advisor answers the way I would at the counter.',
    storyBy: '— Emília, LEDAKCIA store, Bratislava',
    credit: 'Made by Emília Schmidtová · 2026',
    back_step: 'Back',
    step: 'Step {n} of {total}',

    q_room: 'Which space do you want to light?',
    q_room_sub: 'Pick one.',
    q_size: 'How big is it?',
    q_size_sub: 'A guess is fine – pick a preset or drag the sliders.',
    q_mood: 'What kind of light do you want?',
    q_mood_sub: 'Based on what you do there most.',
    q_cons: 'Two practical things',
    q_cons_sub: 'So we pick products that really fit.',

    room_living: 'Living room', room_living_hint: 'sofa, TV, guests',
    room_bedroom: 'Bedroom', room_bedroom_hint: 'rest and sleep',
    room_kitchen: 'Kitchen', room_kitchen_hint: 'cooking, worktop',
    room_bathroom: 'Bathroom', room_bathroom_hint: 'humidity, mirror',
    room_kids: 'Kids’ room', room_kids_hint: 'play and homework',
    room_office: 'Study / office', room_office_hint: 'desk work',
    room_hallway: 'Hallway', room_hallway_hint: 'entry, stairs',
    room_garage: 'Garage / workshop', room_garage_hint: 'car, tools',
    room_garden: 'Garden / terrace', room_garden_hint: 'path, seating',
    room_entrance: 'Entrance / wall', room_entrance_hint: 'door, yard',

    length: 'Length', width: 'Width', height: 'Ceiling height',
    area: 'Area', next: 'Next', show_result: 'Show my result',
    preset_living: ['small', 'medium', 'large', 'open space'],
    preset_bedroom: ['small', 'medium', 'large'],
    preset_kitchen: ['small', 'medium', 'large'],
    preset_bathroom: ['small', 'medium', 'large'],
    preset_kids: ['small', 'medium', 'large'],
    preset_office: ['small', 'medium', 'office'],
    preset_hallway: ['narrow', 'longer', 'entry hall'],
    preset_garage: ['workshop', '1 car', '2 cars'],
    preset_garden: ['path', 'terrace', 'garden'],
    preset_entrance: ['doorway', 'driveway', 'yard'],
    outdoor_size_note: 'Outside, enter the area you actually want to light (path, terrace, space by the door) – not the whole plot.',

    mood_cozy: 'Cozy', mood_cozy_hint: 'evenings, relaxing',
    mood_everyday: 'Everyday', mood_everyday_hint: 'a bit of everything',
    mood_bright: 'Bright', mood_bright_hint: 'work, cooking, detail',
    mood_out_cozy: 'Ambience', mood_out_cozy_hint: 'soft light, decor',
    mood_out_everyday: 'Orientation', mood_out_everyday_hint: 'see the path and steps',
    mood_out_bright: 'Security', mood_out_bright_hint: 'bright when someone comes',

    q_fit: 'What do you already have?',
    fit_e27: 'E27 socket', fit_e27_hint: 'large screw',
    fit_e14: 'E14 socket', fit_e14_hint: 'small screw',
    fit_gu10: 'GU10 spots', fit_gu10_hint: 'recessed spots',
    fit_ceiling: 'Ceiling light', fit_ceiling_hint: 'want to replace it',
    fit_none: 'Nothing / not sure', fit_none_hint: 'starting from scratch',
    q_smart: 'Control the light from your phone?',
    smart_yes: 'Yes, smart', smart_yes_hint: 'app, voice',
    smart_no: 'A switch is fine', smart_no_hint: 'keep it simple',
    q_power: 'Is there power on site?',
    power_yes: 'Yes', power_yes_hint: 'socket / cable',
    power_no: 'No', power_no_hint: 'I want solar',
    q_motion: 'Should it react to movement?',
    motion_yes: 'Yes', motion_yes_hint: 'turns on by itself',
    motion_no: 'No', motion_no_hint: 'on when I want',

    r_eyebrow: 'Your result',
    r_title: '{room} · {area} m² · {mood}',
    r_edit: 'Change answers',
    r_preview: 'How the room will feel',
    r_switch_on: 'On', r_switch_off: 'Off',
    r_try_k: 'Try a different light colour',
    r_reset_k: 'back to recommendation',
    r_lumens: 'Light you need',
    r_lumens_eq: '≈ {w} W of old light bulbs',
    r_lux_line: 'target {lux} lx (recommended {range} lx)',
    r_why: 'Why this much?',
    r_why_formula: '{lux} lx × {area} m² ÷ {util} = {lm} lm',
    r_why_text: 'Lux says how much light lands on 1 m²; lumens say how much the bulbs give out. Some light is “lost” on walls and ceiling, so we divide by a utilisation of {util}.',
    r_why_high: ' With a {h} m ceiling utilisation is lower – the light travels further.',
    r_why_out: ' Outside nothing reflects the light back, so we use a utilisation of only {util}.',
    r_kelvin: 'Light colour',
    k_warm: 'warm white', k_neutral: 'neutral white', k_cool: 'cool / daylight',
    k_desc_2700: 'Like a classic bulb – cosy, yellowish evening light.',
    k_desc_3000: 'Warm but a little cleaner. A safe choice for homes.',
    k_desc_4000: 'Neutral white – true colours, focus, work.',
    k_desc_6000: 'Cool daylight – maximum detail for workshops and garages.',
    r_ip: 'Protection (IP)',
    ip_20: 'Dry indoor space – a standard fitting is fine (IP20).',
    ip_44: 'Near the bath and shower at least IP44; inside the bath/shower IP65 to IP67. This applies to the whole fitting, not the bulb.',
    ip_65_garage: 'A dry garage is fine with IP20; for a dusty workshop or unheated garage I recommend IP65.',
    ip_65_out: 'Outdoors in the rain IP65 (dust-tight, protected against water jets). Under a roof at least IP44.',
    ip_hint: 'First digit = dust protection, second = water.',

    r_products: 'What I would recommend',
    r_products_sub: 'Real products from the LEDAKCIA range, calculated for your room.',
    role_bulbs: 'Bulbs for your sockets',
    role_main: 'Main light',
    role_pendant: 'Second layer: design pendant',
    role_tv: 'TV backlight',
    role_bedside: 'Bedside lamp',
    role_undercab: 'Under-cabinet light',
    role_night: 'Night light by the door or sink',
    role_desk: 'Desk lamp',
    role_kidslamp: 'Kids’ lamp',
    role_neon: 'Night-time decorative light',
    role_motionstrip: 'Motion-sensor light',
    role_decor: 'Ambience along the path',
    role_step: 'Door light with motion sensor',
    role_smart: 'Smart control',
    with_bulb: '+ bulb: {name}',
    qty_pieces: '{n} pcs', qty_piece: '1 pc',
    qty_packs: '{packs} × pack ({n} pcs)',
    qty_spare: '{spare} spare in the pack',
    gives_lm: '{lm} lm in total',
    lm_approx: 'approx.',
    spec_lm: '{v} lm', spec_w: '{v} W', spec_k: '{v} K', spec_ip: 'IP{v}',
    spec_k_unknown: 'check light colour on the shop',
    spec_ip_unknown: 'IP not listed – please check',
    k_switch: 'switchable 3000 / 4000 / 6400 K',
    k_6387: '4000 K or 6400 K variant',
    k_7173: '3000 / 4500 / 6000 K variants',
    k_437: '3000 / 4000 / 6400 K variants',
    k_16004: 'choice of 3000–6000 K',
    price_each: 'each', price_pack: 'per pack of {pack}',
    view_product: 'View on ledakcia.sk',
    votes: '{n} reviews',
    not_counted: 'Extras are not counted in the lumens – they are extra “layers” for ambience or comfort.',
    catalog_error: 'The product catalogue could not be loaded. The numbers above still apply – browse products on ledakcia.sk.',

    r_total: 'Total',
    r_energy: 'Electricity per year',
    r_energy_led: 'LED (this plan)',
    r_energy_old: 'Old light bulbs',
    r_saving: 'You save approx. {eur} a year',
    r_payback: 'The main light pays for itself in approx. {m}.',
    months: ['month', 'months', 'months'],
    r_energy_note: 'Main light, {h} h a day, €{price}/kWh. Old bulb ≈ 12 lm/W.',
    r_solar: 'Powered by the sun',
    r_solar_note: 'Solar lights need no mains electricity – €0 a year.',

    note_sockets: 'Spread the pieces over your sockets. If you have fewer sockets, choose a stronger bulb or add a lamp.',
    note_bath_fixture: 'Only use the bulbs in a fitting rated at least IP44 – the fitting provides protection, not the bulb.',
    note_bath_6387: 'In this sample catalogue this is the only ceiling fitting rated IP65. It looks rather technical – for a more stylish bathroom fitting, ask us in the store.',
    note_solar: 'The solar floodlights have a remote, dimming and a timer (3, 5 or 8 h). Place the panel where it gets sun during the day – a full charge takes 6–7 hours.',
    note_solar_nomotion: 'The solar floodlights in the catalogue have no motion sensor – use the timer instead.',
    note_garden_power: 'Even with power available, solar floodlights save you running cables through the garden.',
    note_sensor_manual: 'According to their description the sensor floodlights also have a manual override, so they don’t only react to movement.',
    note_panel_builtin: 'Recessed panels go into a suspended ceiling; panel 742 has a surface-mount option.',
    note_smart: 'The smart module goes behind your existing switch (leave the wiring to an electrician). You control it in the eWeLink app; it also works with Google Home and Amazon Alexa.',

    tip_title: 'Emília’s tip',
    tip_living: 'Never rely on a single light in the middle of the living-room ceiling. Combine a main light, a lamp by the sofa and something decorative – we call it layering. In the evening you switch off the ceiling and the room instantly feels cosier. Warm white 2700 K is almost always right here.',
    tip_bedroom: 'A bedroom is for resting, not interrogations 🙂 Warm 2700 K, and rather less light from more places. A bedside lamp you can reach without getting up is worth it – and dim the lights an hour before bed to help your body slow down.',
    tip_kitchen: 'The most common kitchen mistake: the only light is on the ceiling behind you, so you shade the chopping board with your own body. Add a strip under the wall cabinets – the worktop gets bright, and neutral 4000 K shows food in its true colours.',
    tip_bathroom: 'For the mirror, look for a high CRI (colour rendering index, ideally 90+), so make-up and shaving look the same as outside. And IP rating isn’t cosmetic – above the bath and shower the fitting needs at least IP44.',
    tip_kids: 'Think of two modes in a kids’ room: bright light for play and homework, and a soft night light so nobody is scared of the dark. Lamps should be stable with a covered bulb – little hands are curious.',
    tip_office: 'For work, aim for 500 lx on the desk and neutral 4000 K – it keeps you alert. Put the lamp to the side (left for right-handers) so your hand casts no shadow, and don’t face the screen towards a window – glare tires the eyes faster than anything.',
    tip_hallway: 'Everyone just passes through a hallway – the perfect spot for a motion sensor. The light switches on when you come in with shopping bags, and nobody forgets to switch it off. Less light is fine, just no dark corners by doors and stairs.',
    tip_garage: 'Don’t save on light in a garage or workshop – bright, even light is a safety matter when you work with tools. IP65 fittings handle dust and damp, and a cooler white shows every detail.',
    tip_garden: 'Don’t light a garden like a car park. Less is more: highlight the path, the steps and one nice tree, and leave the rest in soft darkness. Put solar lights where they get a few hours of sun, or they won’t last the evening.',
    tip_entrance: 'At the entrance it’s mostly about safety: seeing the keyhole, the step and whoever is at the door. A motion sensor is your best friend here – it doesn’t burn all night and it discourages unwanted visitors.',

    btn_restart: 'Start again',
    btn_share: 'Share result',
    btn_print: 'Print',
    copied: 'Summary copied – just paste it into a message.',
    copy_fail: 'Copying failed – please select the text manually.',
    disclaimer: 'The calculation is a guide and deliberately on the generous side. Prices come from the LEDAKCIA catalogue – check current price and availability on ledakcia.sk.',
    share_head: 'Lighting advisor – {room}, {area} m², {mood}',
    share_lm: 'Light needed: {lm} lm (target {lux} lx)',
    share_k: 'Light colour: {k} K ({name})',
    share_ip: 'Protection: IP{ip}',
    share_total: 'Total: {total}',
    share_saving: 'Saving vs old light bulbs: approx. {eur} a year',
    share_link: 'Result: {url}',
  },
};

/* --------------------------------------------------------------------------
   5. ICONS – tiny line drawings (24×24), coloured by CSS
   -------------------------------------------------------------------------- */
const ICONS = {
  living:   '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z"/><path d="M5 18v2M19 18v2"/>',
  bedroom:  '<path d="M3 19V6M3 15h18v4M21 19v-6a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="12" r="2"/>',
  kitchen:  '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M2 10h20M9 6.5c0-1.2 1-1.2 1-2.5M14 6.5c0-1.2 1-1.2 1-2.5"/>',
  bathroom: '<path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M6 12V5.5a2 2 0 0 1 4 0M7 20l-1 2M17 20l1 2"/>',
  kids:     '<rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/><rect x="8.5" y="4" width="7" height="7" rx="1"/>',
  office:   '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  hallway:  '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="15" cy="12" r="1"/>',
  garage:   '<path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v4H3z"/><path d="M3 13h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>',
  garden:   '<path d="M12 3c3 0 5 2.2 5 5 1.8.6 3 2.2 3 4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4c0-1.8 1.2-3.4 3-4 0-2.8 2-5 5-5z"/><path d="M12 16v5M9 21h6"/>',
  entrance: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  cozy:     '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  everyday: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  bright:   '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  e27:      '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  e14:      '<path d="M12 3c2 3 3.2 5 3.2 7a3.2 3.2 0 0 1-6.4 0C8.8 8 10 6 12 3z"/><path d="M10 15.5h4M10.5 18.5h3M11 21h2"/>',
  gu10:     '<path d="M6 4h12l-2 7H8z"/><path d="M9 15l-1.5 5M15 15l1.5 5M12 14v6"/>',
  ceiling:  '<path d="M12 2v5"/><path d="M5 14a7 7 0 0 1 14 0z"/><path d="M10 17a2 2 0 0 0 4 0"/>',
  none:     '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  smart_yes:'<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
  smart_no: '<rect x="7" y="3" width="10" height="18" rx="2"/><rect x="10" y="7" width="4" height="6" rx="1"/>',
  power_yes:'<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
  power_no: '<rect x="3" y="12" width="18" height="8" rx="1"/><path d="M3 16h18M9 12v8M15 12v8M12 2v3M6 5l1.5 1.5M18 5l-1.5 1.5"/>',
  motion_yes:'<circle cx="6" cy="12" r="2"/><path d="M11 8a6 6 0 0 1 0 8M15 5a10 10 0 0 1 0 14M19 2.5a14 14 0 0 1 0 19"/>',
  motion_no:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  copy:     '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  print:    '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/>',
  restart:  '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
const icon = (name, size = 28) =>
  `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;

/* --------------------------------------------------------------------------
   6. SMALL HELPERS
   -------------------------------------------------------------------------- */
let lang = 'sk';
const $ = (sel, root = document) => root.querySelector(sel);

// Translate a key and fill in {placeholders}
function t(key, vars = {}) {
  const s = I18N[lang][key] ?? I18N.sk[key] ?? key;
  if (typeof s !== 'string') return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
// Escape text coming from the product data before putting it into HTML
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const locale = () => (lang === 'sk' ? 'sk-SK' : 'en-GB');
const num = (n, d = 0) => new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const eur = (n) => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' }).format(n);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round1 = (v) => Math.round(v * 10) / 10;
const pieces = (n) => (n === 1 ? t('qty_piece') : t('qty_pieces', { n }));
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Slovak plural for months: 1 mesiac, 2–4 mesiace, 5+ mesiacov
function monthsLabel(m) {
  const forms = t('months');
  const idx = m === 1 ? 0 : (m >= 2 && m <= 4 ? 1 : 2);
  return `${m} ${forms[lang === 'en' && m !== 1 ? 1 : idx]}`;
}

/* --------------------------------------------------------------------------
   7. CATALOGUE – loaded once from the shared products.json
   -------------------------------------------------------------------------- */
let CATALOG = null;      // Map code → product, or null while loading
let catalogFailed = false;

const catalogReady = fetch('../../shared/products.json')
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((list) => { CATALOG = new Map(list.map((p) => [String(p.code), p])); })
  .catch(() => { catalogFailed = true; CATALOG = new Map(); });

const facts = (p) => PRODUCT_FACTS[p.code] || {};
const packOf = (p) => facts(p).pack || 1;
const wattsOf = (p) => facts(p).watts ?? p.watts ?? null;

// Lumens of one piece. If missing in the data we estimate from watts – and say "cca".
function lumensOf(p) {
  if (p.lumens) return { lm: p.lumens, approx: false };
  const w = wattsOf(p);
  if (w) return { lm: Math.round((w * ASSUME.ledLmPerWEstimate) / 10) * 10, approx: true };
  return { lm: null, approx: true };
}

/* --------------------------------------------------------------------------
   8. THE ADVICE – which products fit which answers
   Each "candidate" can be a product alone or a fitting + bulb ("kit").
   -------------------------------------------------------------------------- */
const BULBS = {
  e27:  { cozy: ['44801', '7178', '214453', '2707'], other: ['214453', '2707', '7178'] },
  e14:  { cozy: ['214216', '7173', '214123'],        other: ['7173', '214216', '214123'] },
  gu10: { cozy: ['211685'],                          other: ['211685'] },
};

// Main light for new fittings, per room
const NEW_FITTING = {
  living: ['217603'], bedroom: ['217603'], kids: ['217603'],
  kitchen: ['724', '742'], office: ['724', '742', '20005'],
  hallway: ['217603', '724'], bathroom: ['6387'], garage: ['6387', '6313'],
};

// Extras = additional "layers" (not counted in lumens)
function extrasFor(a) {
  const x = [];
  const add = (code, role, opts = {}) => x.push({ code, role, qty: opts.qty || 1, bulb: opts.bulb, bulbQty: opts.bulbQty });
  switch (a.room) {
    case 'living': {
      // Design pendant over the coffee table, with a bulb that fits the mood
      const pendant = { cozy: '12306', everyday: '3710', bright: '3711' }[a.mood];
      const per = PRODUCT_FACTS[pendant]?.bulbsPer || 1;
      add(pendant, 'role_pendant', { bulb: a.mood === 'bright' ? '214453' : '44801', bulbQty: per });
      if (a.mood !== 'bright') add('12031', 'role_tv');
      break;
    }
    case 'bedroom':  add('7689', 'role_bedside'); break;
    case 'kitchen':  add('16190', 'role_undercab'); break;
    case 'bathroom': add('2574', 'role_night'); break;
    case 'kids':     add('45104', 'role_kidslamp', { bulb: '214216', bulbQty: 1 }); add('49356', 'role_neon'); break;
    case 'office':   add('16004', 'role_desk'); break; // lets you pick 3000–6000 K
    case 'hallway':  add('2574', 'role_motionstrip'); break;
    case 'garden':   add('8689', 'role_decor'); break;
    case 'entrance': if (!a.power && a.motion) add('2574', 'role_step'); break;
  }
  // Smart switch makes sense wherever the light is wired to mains
  if (a.smart && (!ROOMS[a.room].outdoor || a.power)) add('35034', 'role_smart');
  return x;
}

// Which main light candidates + notes fit these answers?
function mainCandidates(a) {
  const room = ROOMS[a.room];
  const notes = [];
  let codes, role = 'role_main', style;

  if (room.outdoor) {
    const sensorFloods = a.room === 'entrance' ? ['437', '449', '458'] : ['449', '437', '458'];
    const solarFloods = ['8573', '8574', '8575'];
    if (!a.power) {
      codes = solarFloods; style = 'solar';
      notes.push('note_solar');
      if (a.motion) notes.push('note_solar_nomotion');
    } else if (a.motion) {
      codes = sensorFloods; style = 'flood';
    } else if (a.room === 'garden') {
      codes = solarFloods; style = 'solar';
      notes.push('note_garden_power', 'note_solar');
    } else {
      codes = sensorFloods; style = 'flood';
      notes.push('note_sensor_manual');
    }
  } else if (BULBS[a.fit]) {
    codes = BULBS[a.fit][a.mood === 'cozy' ? 'cozy' : 'other'];
    role = 'role_bulbs';
    style = a.fit === 'gu10' ? 'spots' : 'pendant';
    notes.push('note_sockets');
    if (a.room === 'bathroom') notes.push('note_bath_fixture');
  } else {
    codes = NEW_FITTING[a.room];
    style = { '217603': 'ceiling', '724': 'panel', '742': 'panel', '20005': 'panel', '6387': 'batten', '6313': 'batten' }[codes[0]];
    if (a.room === 'bathroom') notes.push('note_bath_6387');
    if (codes.includes('724')) notes.push('note_panel_builtin');
  }
  if (a.smart && (!room.outdoor || a.power)) notes.push('note_smart');
  return { codes, role, style, notes };
}

/* Pick the best candidate: enough light, without wild overshoot, not too many pieces.
   score = overshoot + penalty per piece (fewer pieces = less installing and usually
   cheaper) + small penalty for being further down our preference list. Lowest wins. */
function pickMain(codes, targetLm) {
  let best = null;
  codes.forEach((code, i) => {
    const p = CATALOG.get(code);
    if (!p) return;
    const { lm, approx } = lumensOf(p);
    if (!lm) return;
    const units = Math.max(1, Math.ceil(targetLm / lm));
    const score = (units * lm) / targetLm - 1 + units * 0.08 + i * 0.05;
    if (!best || score < best.score) best = { p, units, lm, approx, score };
  });
  return best;
}

/* --------------------------------------------------------------------------
   9. THE CALCULATION – pure function: answers in, numbers out
   -------------------------------------------------------------------------- */
function compute(a) {
  const room = ROOMS[a.room];
  const area = round1(a.l * a.w);
  const lux = room.lux[a.mood];

  // Utilisation: 0.8 indoors, a bit lower with high ceilings, 0.6 outdoors
  let util = room.outdoor ? ASSUME.utilisationOutdoor : ASSUME.utilisation;
  if (!room.outdoor && a.h > ASSUME.refCeiling) {
    util = Math.max(ASSUME.minUtilisation, ASSUME.utilisation * (ASSUME.refCeiling / a.h));
  }
  util = Math.round(util * 100) / 100;

  // lumens = lux × area ÷ utilisation, rounded up to the nearest 50
  const lumens = Math.ceil((lux * area) / util / 50) * 50;
  const kelvin = room.kelvin[a.mood];
  const ip = room.ip;

  const res = { a, room, area, lux, util, lumens, kelvin, ip, main: null, extras: [], notes: [], style: 'pendant' };
  if (!CATALOG || CATALOG.size === 0) return res;

  // Main light
  const cand = mainCandidates(a);
  res.notes = cand.notes;
  res.style = cand.style;
  const pick = pickMain(cand.codes, lumens);
  // The recessed-panel note only matters if we actually picked the recessed panel
  if (pick && pick.p.code !== '724') res.notes = res.notes.filter((n) => n !== 'note_panel_builtin');
  if (pick) {
    const pack = packOf(pick.p);
    const packs = Math.ceil(pick.units / pack);
    const unitW = wattsOf(pick.p) ?? pick.lm / 100;
    const totalLm = pick.units * pick.lm;
    const solar = cand.style === 'solar';
    const kwh = (w) => (w * ASSUME.hoursPerDay * 365) / 1000;
    const ledCost = solar ? 0 : kwh(pick.units * unitW) * ASSUME.eurPerKWh;
    const oldCost = kwh(totalLm / ASSUME.incandescentLmPerW) * ASSUME.eurPerKWh;
    res.main = {
      p: pick.p, role: cand.role, units: pick.units, unitLm: pick.lm, approx: pick.approx,
      pack, packs, spare: packs * pack - pick.units, totalLm,
      cost: packs * pick.p.price, ledCost, oldCost, saving: oldCost - ledCost, solar,
    };
  }

  // Extras
  res.extras = extrasFor(a).map((x) => {
    const p = CATALOG.get(x.code);
    if (!p) return null;
    const b = x.bulb ? CATALOG.get(x.bulb) : null;
    const packs = Math.ceil(x.qty / packOf(p));
    const cost = packs * p.price + (b ? Math.ceil((x.qty * x.bulbQty) / packOf(b)) * b.price : 0);
    return { ...x, p, b, packs, cost };
  }).filter(Boolean);

  res.total = (res.main ? res.main.cost : 0) + res.extras.reduce((s, x) => s + x.cost, 0);
  return res;
}

/* --------------------------------------------------------------------------
   10. STATE + QUIZ SCREENS
   -------------------------------------------------------------------------- */
const STEPS = ['room', 'size', 'mood', 'constraints'];
let step = 0;
let answers = freshAnswers();
let previewK = null;        // colour the visitor is "trying" in the room preview
let lightOn = true;
let lastResult = null;

function freshAnswers() {
  return { room: null, l: 4, w: 4, h: 2.6, mood: null, fit: null, smart: null, power: null, motion: null };
}

// A tappable answer card
function choice(group, value, iconName, label, hint, selected) {
  return `<button type="button" class="choice${selected ? ' on' : ''}" data-pick="${group}" data-value="${value}" aria-pressed="${selected}">
    <span class="choice-ico">${icon(iconName)}</span>
    <span class="choice-txt"><b>${label}</b><small>${hint}</small></span>
  </button>`;
}

function renderStep() {
  const area = $('#stepArea');
  const total = STEPS.length;
  $('#progressBar').style.width = `${((step + 1) / total) * 100}%`;
  $('#progress').setAttribute('aria-valuenow', step + 1);
  $('#stepCount').textContent = t('step', { n: step + 1, total });
  $('#backBtn').style.visibility = step === 0 ? 'hidden' : 'visible';

  let html = '';
  const name = STEPS[step];
  const outdoor = answers.room && ROOMS[answers.room].outdoor;

  if (name === 'room') {
    html = head('q_room', 'q_room_sub') + `<div class="choices grid-rooms">${
      ROOM_ORDER.map((r) => choice('room', r, r, t(`room_${r}`), t(`room_${r}_hint`), answers.room === r)).join('')}</div>`;
  }

  if (name === 'size') {
    const room = ROOMS[answers.room];
    const max = outdoor ? 25 : 12;
    const labels = t(`preset_${answers.room}`);
    html = head('q_size', 'q_size_sub') + `
      <div class="size-box">
        <div class="area-display"><span id="areaVal">${num(round1(answers.l * answers.w), 1)}</span><small> m²</small></div>
        <div class="presets">${room.presets.map(([l, w], i) => {
          const on = answers.l === l && answers.w === w;
          return `<button type="button" class="chip${on ? ' on' : ''}" data-preset="${l}x${w}">${labels[i]} · ${num(l * w)} m²</button>`;
        }).join('')}</div>
        ${slider('l', t('length'), answers.l, 1, max, 0.5, 'm')}
        ${slider('w', t('width'), answers.w, 1, max, 0.5, 'm')}
        ${outdoor ? `<p class="hint">${t('outdoor_size_note')}</p>` : slider('h', t('height'), answers.h, 2.2, 4, 0.1, 'm')}
      </div>
      <div class="step-actions"><button type="button" class="btn big" data-next>${t('next')}</button></div>`;
  }

  if (name === 'mood') {
    const pre = outdoor ? 'mood_out_' : 'mood_';
    html = head('q_mood', 'q_mood_sub') + `<div class="choices grid-3">${
      MOODS.map((m) => choice('mood', m, m, t(pre + m), t(pre + m + '_hint'), answers.mood === m)).join('')}</div>`;
  }

  if (name === 'constraints') {
    if (outdoor) {
      html = head('q_cons', 'q_cons_sub') +
        `<h3 class="sub-q">${t('q_power')}</h3><div class="choices grid-2">
          ${choice('power', 1, 'power_yes', t('power_yes'), t('power_yes_hint'), answers.power === 1)}
          ${choice('power', 0, 'power_no', t('power_no'), t('power_no_hint'), answers.power === 0)}</div>
         <h3 class="sub-q">${t('q_motion')}</h3><div class="choices grid-2">
          ${choice('motion', 1, 'motion_yes', t('motion_yes'), t('motion_yes_hint'), answers.motion === 1)}
          ${choice('motion', 0, 'motion_no', t('motion_no'), t('motion_no_hint'), answers.motion === 0)}</div>`;
    } else {
      html = head('q_cons', 'q_cons_sub') +
        `<h3 class="sub-q">${t('q_fit')}</h3><div class="choices grid-fit">
          ${FITTINGS.map((f) => choice('fit', f, f, t(`fit_${f}`), t(`fit_${f}_hint`), answers.fit === f)).join('')}</div>
         <h3 class="sub-q">${t('q_smart')}</h3><div class="choices grid-2">
          ${choice('smart', 1, 'smart_yes', t('smart_yes'), t('smart_yes_hint'), answers.smart === 1)}
          ${choice('smart', 0, 'smart_no', t('smart_no'), t('smart_no_hint'), answers.smart === 0)}</div>`;
    }
    const ready = outdoor ? answers.power !== null && answers.motion !== null : answers.fit !== null && answers.smart !== null;
    html += `<div class="step-actions"><button type="button" class="btn big" data-finish ${ready ? '' : 'disabled'}>${t('show_result')} →</button></div>`;
  }

  area.innerHTML = `<div class="step-anim">${html}</div>`;
}

const head = (q, sub) => `<h2 class="q" tabindex="-1">${t(q)}</h2><p class="q-sub muted">${t(sub)}</p>`;

function slider(key, label, value, min, max, stepV, unit) {
  return `<div class="slider">
    <div class="slider-top"><label for="sl-${key}">${label}</label><output id="out-${key}">${num(value, 1)} ${unit}</output></div>
    <input type="range" id="sl-${key}" data-slider="${key}" min="${min}" max="${max}" step="${stepV}" value="${value}">
  </div>`;
}

function goTo(n) {
  step = clamp(n, 0, STEPS.length - 1);
  renderStep();
  const q = $('#stepArea .q');
  if (q && document.activeElement && document.activeElement !== document.body) q.focus({ preventScroll: true });
}

// One click handler for the whole quiz (event delegation)
$('#stepArea').addEventListener('click', (e) => {
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    const { pick: group, value } = pick.dataset;
    const val = ['smart', 'power', 'motion'].includes(group) ? Number(value) : value;
    if (group === 'room' && answers.room !== val) {
      // New room → fresh defaults that make sense for it
      const r = ROOMS[val];
      answers = { ...freshAnswers(), room: val, l: r.size[0], w: r.size[1] };
    } else {
      answers[group] = val;
    }
    // Room and mood are single questions → move on automatically
    if (group === 'room' || group === 'mood') {
      renderStep();
      setTimeout(() => goTo(step + 1), prefersReducedMotion() ? 0 : 220);
    } else {
      renderStep();
    }
    return;
  }
  const preset = e.target.closest('[data-preset]');
  if (preset) {
    const [l, w] = preset.dataset.preset.split('x').map(Number);
    answers.l = l; answers.w = w;
    renderStep();
    return;
  }
  if (e.target.closest('[data-next]')) goTo(step + 1);
  if (e.target.closest('[data-finish]')) showResult(true);
});

// Sliders update live without re-rendering (so dragging stays smooth)
$('#stepArea').addEventListener('input', (e) => {
  const key = e.target.dataset.slider;
  if (!key) return;
  answers[key] = Number(e.target.value);
  $(`#out-${key}`).textContent = `${num(answers[key], 1)} m`;
  $('#areaVal').textContent = num(round1(answers.l * answers.w), 1);
  document.querySelectorAll('[data-preset]').forEach((b) => {
    const [l, w] = b.dataset.preset.split('x').map(Number);
    b.classList.toggle('on', l === answers.l && w === answers.w);
  });
});

$('#backBtn').addEventListener('click', () => goTo(step - 1));

/* --------------------------------------------------------------------------
   11. RESULT SCREEN
   -------------------------------------------------------------------------- */
function kelvinName(k) { return k <= 3000 ? t('k_warm') : k < 5000 ? t('k_neutral') : t('k_cool'); }
function kelvinDesc(k) { return t(k <= 2700 ? 'k_desc_2700' : k <= 3000 ? 'k_desc_3000' : k < 5000 ? 'k_desc_4000' : 'k_desc_6000'); }
function moodLabel(a) { return t((ROOMS[a.room].outdoor ? 'mood_out_' : 'mood_') + a.mood).toLowerCase(); }

async function showResult(scrollUp) {
  await catalogReady;
  const r = compute(answers);
  lastResult = r;
  previewK = r.kelvin;
  lightOn = true;
  $('#quiz').hidden = true;
  const box = $('#result');
  box.hidden = false;
  box.innerHTML = resultHTML(r);
  setupPreview(r);
  updateUrl();
  if (scrollUp) box.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

function resultHTML(r) {
  const a = r.a;
  const kPos = ((clamp(r.kelvin, 2200, 6500) - 2200) / (6500 - 2200)) * 100;
  const ipKey = r.ip === 20 ? 'ip_20' : r.ip === 44 ? 'ip_44' : a.room === 'garage' ? 'ip_65_garage' : 'ip_65_out';
  const why = t('r_why_text', { util: num(r.util, 2) })
    + (!r.room.outdoor && a.h > ASSUME.refCeiling ? t('r_why_high', { h: num(a.h, 1) }) : '')
    + (r.room.outdoor ? t('r_why_out', { util: num(r.util, 2) }) : '');

  return `
  <div class="result-head">
    <div>
      <p class="eyebrow">${t('r_eyebrow')}</p>
      <h2>${t('r_title', { room: t(`room_${a.room}`), area: num(r.area, 1), mood: moodLabel(a) })}</h2>
    </div>
    <button type="button" class="btn ghost no-print" data-act="edit">${t('r_edit')}</button>
  </div>

  <!-- The "wow" moment: a little room that lights up -->
  <div class="card preview-card">
    <div class="preview-top">
      <h3>${t('r_preview')}</h3>
      <button type="button" class="switch no-print" data-act="toggle" aria-pressed="true">
        <span class="switch-knob"></span><span class="switch-label">${t('r_switch_on')}</span>
      </button>
    </div>
    <div class="scene" id="scene">${sceneSVG(r)}</div>
    <div class="k-try no-print">
      <div class="k-try-top"><label for="kTry">${t('r_try_k')}</label>
        <span><output id="kTryOut">${num(r.kelvin)} K</output> · <button type="button" class="linkish" data-act="resetK">${t('r_reset_k')}</button></span></div>
      <input type="range" id="kTry" min="2200" max="6500" step="100" value="${r.kelvin}" class="k-range">
    </div>
  </div>

  <!-- Three key numbers -->
  <div class="stats">
    <div class="card stat">
      <p class="stat-label">${t('r_lumens')}</p>
      <p class="stat-big">${num(r.lumens)} <small>lm</small></p>
      <p class="muted small">${t('r_lux_line', { lux: r.lux, range: r.room.range })}<br>${t('r_lumens_eq', { w: num(Math.round(r.lumens / ASSUME.incandescentLmPerW / 5) * 5) })}</p>
      <details class="why">
        <summary>${t('r_why')}</summary>
        <p class="formula">${t('r_why_formula', { lux: r.lux, area: num(r.area, 1), util: num(r.util, 2), lm: num(r.lumens) })}</p>
        <p class="small">${why}</p>
      </details>
    </div>
    <div class="card stat">
      <p class="stat-label">${t('r_kelvin')}</p>
      <p class="stat-big">${num(r.kelvin)} <small>K</small></p>
      <p class="muted small"><b class="k-name">${kelvinName(r.kelvin)}</b> – ${kelvinDesc(r.kelvin)}</p>
      <div class="k-bar" aria-hidden="true" style="background:${kelvinGradient()}">
        <span class="k-marker" style="left:${kPos}%"></span>
      </div>
      <div class="k-scale"><span>2700 K</span><span>4000 K</span><span>6000 K+</span></div>
    </div>
    <div class="card stat">
      <p class="stat-label">${t('r_ip')}</p>
      <p class="stat-big">IP${r.ip}${r.ip > 20 ? '<small>+</small>' : ''}</p>
      <p class="muted small">${t(ipKey)}</p>
      <p class="hint">${t('ip_hint')}</p>
    </div>
  </div>

  ${productsHTML(r)}

  <!-- Emília's tip -->
  <aside class="card tip">
    <div class="tip-avatar" aria-hidden="true">E</div>
    <div>
      <p class="eyebrow">${t('tip_title')}</p>
      <p class="tip-text">${t(`tip_${a.room}`)}</p>
    </div>
  </aside>

  <div class="result-actions no-print">
    <button type="button" class="btn" data-act="share">${icon('copy', 18)} ${t('btn_share')}</button>
    <button type="button" class="btn ghost" data-act="print">${icon('print', 18)} ${t('btn_print')}</button>
    <button type="button" class="btn ghost" data-act="restart">${icon('restart', 18)} ${t('btn_restart')}</button>
  </div>
  <p class="disclaimer muted">${t('disclaimer')}</p>`;
}

function productsHTML(r) {
  if (catalogFailed || !r.main) {
    return `<div class="card notice">${t('catalog_error')}</div>`;
  }
  const m = r.main;
  const qty = m.pack > 1
    ? `${t('qty_packs', { packs: m.packs, n: m.packs * m.pack })}`
    : pieces(m.units);
  const lmTxt = `${m.approx ? t('lm_approx') + ' ' : ''}${num(m.totalLm)}`;
  const spare = m.spare > 0 ? ` · ${t('qty_spare', { pack: m.pack, spare: m.spare })}` : '';

  const energy = m.solar
    ? `<div class="energy solar"><p class="stat-label">${t('r_energy')}</p><p class="saving">☀️ ${t('r_solar')}</p><p class="muted small">${t('r_solar_note')}</p></div>`
    : energyHTML(m);

  return `
  <section class="products">
    <h3 class="section-title">${t('r_products')}</h3>
    <p class="muted">${t('r_products_sub')}</p>

    ${productCard(m.p, { role: t(m.role), qty, extra: `${t('gives_lm', { lm: lmTxt })}${spare}`, cost: m.cost, main: true })}
    ${r.notes.length ? `<ul class="notes">${r.notes.map((n) => `<li>${t(n)}</li>`).join('')}</ul>` : ''}

    ${r.extras.length ? `<div class="extras">${r.extras.map((x) => productCard(x.p, {
      role: t(x.role),
      qty: packOf(x.p) > 1 ? t('qty_packs', { packs: x.packs, n: x.packs * packOf(x.p) }) : pieces(x.qty),
      bulb: x.b ? `${t('with_bulb', { name: esc(x.b.name) })} · ${x.bulbQty}× ${eur(x.b.price)}` : '',
      cost: x.cost,
    })).join('')}</div>
    <p class="hint">${t('not_counted')}</p>` : ''}

    <div class="card totals">
      <div class="total-box">
        <p class="stat-label">${t('r_total')}</p>
        <p class="total-price">${eur(r.total)}</p>
      </div>
      ${energy}
    </div>
  </section>`;
}

function energyHTML(m) {
  const max = Math.max(m.oldCost, 0.01);
  const months = m.saving > 0 ? Math.max(1, Math.round((m.cost / m.saving) * 12)) : null;
  return `<div class="energy">
    <p class="stat-label">${t('r_energy')}</p>
    <div class="bars">
      <div class="bar-row"><span>${t('r_energy_old')}</span><div class="bar"><i class="old" style="width:100%"></i></div><b>${eur(m.oldCost)}</b></div>
      <div class="bar-row"><span>${t('r_energy_led')}</span><div class="bar"><i class="led" style="width:${Math.max(2, (m.ledCost / max) * 100)}%"></i></div><b>${eur(m.ledCost)}</b></div>
    </div>
    <p class="saving">${t('r_saving', { eur: eur(m.saving) })}</p>
    ${months && months <= 36 ? `<p class="small">${t('r_payback', { m: monthsLabel(months) })}</p>` : ''}
    <p class="hint">${t('r_energy_note', { h: ASSUME.hoursPerDay, price: num(ASSUME.eurPerKWh, 2) })}</p>
  </div>`;
}

// One product card. Only shows facts that are in the data (or its own description).
function productCard(p, o) {
  const f = facts(p);
  const { lm, approx } = lumensOf(p);
  const chips = [];
  // Pendants/lamps without built-in LEDs: their "watts" is the max bulb – don't show as consumption
  const isFittingOnly = ['12306', '3837', '3710', '3711', '45104', '35034', '35098'].includes(p.code);
  // Estimated lumens only where we need them for counting (main light); extras show data only
  if (!isFittingOnly && lm && (!approx || o.main)) chips.push(`${approx ? t('lm_approx') + ' ' : ''}${t('spec_lm', { v: num(lm) })}`);
  if (!isFittingOnly && wattsOf(p)) chips.push(t('spec_w', { v: num(wattsOf(p), wattsOf(p) % 1 ? 1 : 0) }));
  if (f.kelvinNote) chips.push(t(f.kelvinNote));
  else if (p.kelvin) chips.push(t('spec_k', { v: num(p.kelvin) }));
  else if (!isFittingOnly) chips.push(`<span class="unknown">${t('spec_k_unknown')}</span>`);
  if (p.ip) chips.push(t('spec_ip', { v: p.ip }));
  else if (o.main && ROOMS[answers.room].outdoor) chips.push(`<span class="unknown">${t('spec_ip_unknown')}</span>`);

  const old = p.commonPrice && p.commonPrice > p.price ? `<s>${eur(p.commonPrice)}</s>` : '';
  const pack = packOf(p);
  const priceUnit = pack > 1 ? t('price_pack', { pack }) : t('price_each');
  const stars = p.votes > 0 ? `<span class="stars" title="${p.rating} / 5">★ ${num(p.rating, 1)} <small>(${t('votes', { n: p.votes })})</small></span>` : '';

  return `<article class="card product${o.main ? ' main' : ''}">
    <img src="../../shared/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" width="120" height="120">
    <div class="product-body">
      <p class="role">${o.role}</p>
      <h4>${esc(p.name)}</h4>
      <p class="brand muted">${esc(p.brand || '')} ${stars}</p>
      <div class="chips">${chips.map((c) => `<span>${c}</span>`).join('')}</div>
      ${o.bulb ? `<p class="small muted">${o.bulb}</p>` : ''}
      <div class="product-foot">
        <div class="qty"><b>${o.qty}</b>${o.extra ? `<small>${o.extra}</small>` : ''}</div>
        <div class="price"><span>${eur(p.price)} ${old}</span><small>${priceUnit}</small><b>${eur(o.cost)}</b></div>
      </div>
      <a class="buy" href="${esc(p.url)}" target="_blank" rel="noopener">${t('view_product')} ${icon('external', 16)}</a>
    </div>
  </article>`;
}

/* --------------------------------------------------------------------------
   12. ROOM PREVIEW – an SVG room that "switches on" in the chosen colour
   -------------------------------------------------------------------------- */

// Simplified colour for a Kelvin value (hand-tuned so the difference is visible on screen)
const K_STOPS = [[1800, [255, 140, 40]], [2200, [255, 162, 72]], [2700, [255, 186, 112]], [3000, [255, 200, 138]],
  [4000, [255, 232, 204]], [5000, [246, 244, 240]], [6000, [222, 234, 255]], [6500, [208, 224, 255]]];
function kelvinRGB(k) {
  for (let i = 1; i < K_STOPS.length; i++) {
    const [k1, c1] = K_STOPS[i - 1], [k2, c2] = K_STOPS[i];
    if (k <= k2) {
      const f = clamp((k - k1) / (k2 - k1), 0, 1);
      return c1.map((v, j) => Math.round(v + (c2[j] - v) * f));
    }
  }
  return K_STOPS[K_STOPS.length - 1][1];
}
const rgb = (c) => `rgb(${c.join(',')})`;
function kelvinGradient() {
  return `linear-gradient(90deg, ${[2200, 2700, 3000, 4000, 5000, 6000, 6500].map((k) => rgb(kelvinRGB(k))).join(', ')})`;
}

// How bright the scene looks: 10 lx → 0.25, 500 lx → 1
const brightness = (lux) => 0.25 + 0.75 * clamp(Math.log(lux / 10) / Math.log(50), 0, 1);

function sceneSVG(r) {
  const a = r.a;
  const out = r.room.outdoor;
  const b = brightness(r.lux);
  const lights = [];      // where light comes from: {x, y, r}
  let lamps = '';         // the fittings themselves

  const units = r.main ? r.main.units : 1;
  const style = r.style;
  const lampFx = 'class="lamp-fx"';

  // Main light fittings
  if (!out) {
    if (style === 'spots') {
      const n = clamp(units, 2, 5);
      for (let i = 0; i < n; i++) {
        const x = 130 + (220 / (n - 1)) * i;
        lamps += `<ellipse cx="${x}" cy="26" rx="10" ry="4" ${lampFx}/>`;
        lights.push({ x, y: 120, r: 120 + 70 * b });
      }
    } else if (style === 'panel') {
      const n = clamp(units, 1, 3);
      const xs = n === 1 ? [240] : n === 2 ? [180, 300] : [150, 240, 330];
      xs.forEach((x) => { lamps += `<rect x="${x - 32}" y="14" width="64" height="12" rx="2" ${lampFx}/>`; lights.push({ x, y: 80, r: 170 + 90 * b }); });
    } else if (style === 'batten') {
      const n = clamp(units, 1, 2);
      const xs = n === 1 ? [240] : [165, 315];
      xs.forEach((x) => {
        lamps += `<rect x="${x - 70}" y="12" width="140" height="12" rx="5" fill="#d9dbdf"/><rect x="${x - 64}" y="16" width="128" height="5" rx="2.5" ${lampFx}/>`;
        lights.push({ x, y: 80, r: 190 + 90 * b });
      });
    } else if (style === 'ceiling') {
      lamps += `<ellipse cx="240" cy="16" rx="50" ry="10" fill="#e5e2dc"/><ellipse cx="240" cy="19" rx="42" ry="7" ${lampFx}/>`;
      lights.push({ x: 240, y: 70, r: 230 + 90 * b });
    } else { // pendant
      lamps += `<line x1="240" y1="0" x2="240" y2="58" stroke="#555" stroke-width="1.5"/>
        <path d="M222 58h36l12 24h-60z" fill="#3a3f4b"/><circle cx="240" cy="85" r="7" ${lampFx}/>`;
      lights.push({ x: 240, y: 95, r: 210 + 100 * b });
    }
  } else {
    // Outdoor: floodlights on the wall or on posts
    if (a.room === 'entrance') {
      lamps += `<rect x="226" y="80" width="28" height="18" rx="3" fill="#2b2f3a"/><rect x="229" y="92" width="22" height="5" rx="2" ${lampFx}/>`;
      if (style === 'solar') lamps += `<rect x="300" y="44" width="46" height="26" fill="#22314f" stroke="#6b7a99" transform="skewX(-12)"/>`;
      lights.push({ x: 240, y: 170, r: 170 + 120 * b });
    } else {
      const n = clamp(units, 1, 3);
      const xs = n === 1 ? [330] : n === 2 ? [140, 340] : [110, 250, 390];
      xs.forEach((x) => {
        lamps += `<rect x="${x - 2}" y="150" width="4" height="50" fill="#2b2f3a"/><rect x="${x - 13}" y="140" width="26" height="14" rx="2" fill="#2b2f3a"/><rect x="${x - 10}" y="150" width="20" height="4" rx="2" ${lampFx}/>`;
        lights.push({ x, y: 215, r: 120 + 90 * b });
      });
    }
  }

  // Extra fittings that also glow
  const has = (code) => r.extras.some((x) => x.code === code);
  if (has('16190')) { lamps += `<rect x="196" y="113" width="200" height="3" rx="1.5" ${lampFx}/>`; lights.push({ x: 296, y: 135, r: 90 }); }
  if (has('7689'))  { lights.push({ x: 386, y: 160, r: 70 }); }
  if (has('16004')) { lights.push({ x: 222, y: 150, r: 80 }); }
  if (has('45104')) { lights.push({ x: 378, y: 165, r: 60 }); }
  if (has('8689'))  { [[205, 230], [180, 262], [282, 230], [312, 262]].forEach(([x, y]) => lights.push({ x, y, r: 34 })); }
  if (a.room === 'living' && r.extras.some((x) => x.role === 'role_pendant')) {
    lamps += `<line x1="345" y1="0" x2="345" y2="112" stroke="#555" stroke-width="1.2"/><path d="M331 112h28l-4 14h-20z" fill="#b87333"/><circle cx="345" cy="129" r="5" ${lampFx}/>`;
    lights.push({ x: 345, y: 160, r: 120 });
  }

  const holes = lights.map((l) => `<circle cx="${l.x}" cy="${l.y}" r="${Math.round(l.r)}" fill="url(#pvHole)"/>`).join('');
  const blobs = lights.map((l) => `<circle cx="${l.x}" cy="${l.y}" r="${Math.round(l.r)}" fill="url(#pvBlob)"/>`).join('');
  const glows = lights.map((l) => `<circle cx="${l.x}" cy="${l.y}" r="${Math.round(l.r * 0.55)}" fill="url(#pvGlow)"/>`).join('');

  return `<svg viewBox="0 0 480 300" role="img" aria-label="${t('r_preview')}" class="scene-svg${out ? ' outdoor' : ''}">
    <defs>
      <radialGradient id="pvHole"><stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset=".55" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <radialGradient id="pvBlob"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <radialGradient id="pvGlow"><stop offset="0" class="k-stop" stop-opacity=".95"/><stop offset=".45" class="k-stop" stop-opacity=".35"/><stop offset="1" class="k-stop" stop-opacity="0"/></radialGradient>
      <mask id="pvDarkMask" maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="300"><rect width="480" height="300" fill="#fff"/><g class="pv-holes">${holes}</g></mask>
      <mask id="pvTintMask" maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="300"><rect width="480" height="300" fill="${out ? '#000' : '#9a9a9a'}"/>${blobs}</mask>
      <pattern id="tiles" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#e3edf0"/><path d="M20 0H0V20" fill="none" stroke="#c7d6db" stroke-width="1"/></pattern>
    </defs>
    ${out ? exteriorScene(a.room) : interiorScene(a.room)}
    <g class="pv-lamps">${lamps}</g>
    <rect class="pv-tint" width="480" height="300" mask="url(#pvTintMask)"/>
    <rect class="pv-dark" width="480" height="300" fill="#070912" mask="url(#pvDarkMask)" data-b="${b.toFixed(2)}"/>
    <g class="pv-glow">${glows}</g>
  </svg>`;
}

// The empty room: walls, floor, window – plus furniture for each room type
function interiorScene(room) {
  const palette = {
    bathroom: { wall: 'url(#tiles)', side: '#d5e2e6', floor: '#9fb3ba', ceil: '#f2f5f6' },
    garage:   { wall: '#cfcfca', side: '#bdbdb7', floor: '#9d9d97', ceil: '#dcdcd7' },
    kitchen:  { wall: '#efe8dc', side: '#e1d8c9', floor: '#c9b393', ceil: '#f6f2ea' },
    kids:     { wall: '#e4eef0', side: '#d3e1e4', floor: '#c49e74', ceil: '#f5f8f8' },
  }[room] || { wall: '#ece4d6', side: '#ded4c3', floor: '#b88f66', ceil: '#f5f0e7' };

  const shell = `
    <polygon points="0,0 480,0 410,40 70,40" fill="${palette.ceil}"/>
    <polygon points="0,0 70,40 70,210 0,300" fill="${palette.side}"/>
    <polygon points="480,0 410,40 410,210 480,300" fill="${palette.side}"/>
    <rect x="70" y="40" width="340" height="170" fill="${palette.wall}"/>
    <polygon points="70,210 410,210 480,300 0,300" fill="${palette.floor}"/>
    ${room === 'garage' ? '' : '<path d="M60 225H420M45 245H435M25 270H455" stroke="rgba(0,0,0,.08)" stroke-width="1.5"/>'}`;
  const windowSVG = (x, y, w = 70, h = 80) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1b2544"/>
    <circle cx="${x + w * 0.72}" cy="${y + h * 0.28}" r="7" fill="#e9e6d6"/>
    <circle cx="${x + w * 0.25}" cy="${y + h * 0.2}" r="1" fill="#fff"/><circle cx="${x + w * 0.45}" cy="${y + h * 0.5}" r="1" fill="#fff"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#fbfaf7" stroke-width="5"/>
    <path d="M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}" stroke="#fbfaf7" stroke-width="3"/>`;

  const F = {
    living: `${windowSVG(92, 66)}
      <rect x="232" y="72" width="54" height="38" fill="#d9902b"/><circle cx="250" cy="88" r="9" fill="#f3c27f"/><rect x="232" y="72" width="54" height="38" fill="none" stroke="#5b4636" stroke-width="3"/>
      <ellipse cx="270" cy="258" rx="150" ry="24" fill="#e6d8c2"/>
      <rect x="228" y="138" width="164" height="50" rx="12" fill="#6f86a6"/>
      <rect x="220" y="172" width="180" height="34" rx="9" fill="#8197b5"/>
      <rect x="212" y="158" width="20" height="50" rx="8" fill="#6f86a6"/><rect x="388" y="158" width="20" height="50" rx="8" fill="#6f86a6"/>
      <rect x="246" y="148" width="36" height="28" rx="7" fill="#e8c36a"/><rect x="336" y="148" width="36" height="28" rx="7" fill="#e59d7a"/>
      <rect x="222" y="206" width="5" height="10" fill="#4a3a2c"/><rect x="393" y="206" width="5" height="10" fill="#4a3a2c"/>
      <rect x="250" y="236" width="110" height="8" rx="3" fill="#8a5a3b"/><rect x="258" y="244" width="5" height="18" fill="#6e452c"/><rect x="347" y="244" width="5" height="18" fill="#6e452c"/>
      <rect x="110" y="190" width="24" height="24" rx="3" fill="#b9714a"/><ellipse cx="114" cy="178" rx="9" ry="18" fill="#4f7d4e" transform="rotate(-20 114 178)"/><ellipse cx="130" cy="176" rx="9" ry="19" fill="#5f9460" transform="rotate(18 130 176)"/>
      <line x1="180" y1="214" x2="180" y2="130" stroke="#3a3f4b" stroke-width="3"/><path d="M166 112h28l6 20h-40z" fill="#efe6d4"/>`,
    bedroom: `${windowSVG(92, 66)}
      <rect x="188" y="122" width="168" height="80" rx="14" fill="#9b7a9c"/>
      <rect x="182" y="176" width="180" height="24" rx="6" fill="#f5f1ea"/>
      <ellipse cx="232" cy="176" rx="30" ry="11" fill="#fff"/><ellipse cx="312" cy="176" rx="30" ry="11" fill="#fff"/>
      <path d="M176 192H368L388 268H156Z" fill="#b9a0c8"/><path d="M176 205H368" stroke="#a689b6" stroke-width="3"/>
      <rect x="372" y="172" width="34" height="38" rx="3" fill="#8a5a3b"/><rect x="380" y="150" width="14" height="22" rx="7" fill="#f2ead8"/>
      <rect x="90" y="226" width="60" height="30" rx="6" fill="#e6d8c2"/>`,
    kitchen: `${windowSVG(92, 60, 64, 70)}
      <rect x="186" y="56" width="214" height="56" fill="#f8f5ef" stroke="#d8d0c2"/><path d="M257 56v56M328 56v56" stroke="#d8d0c2"/>
      <rect x="244" y="80" width="8" height="2" fill="#9a9a9a"/><rect x="263" y="80" width="8" height="2" fill="#9a9a9a"/><rect x="334" y="80" width="8" height="2" fill="#9a9a9a"/>
      <rect x="186" y="116" width="214" height="34" fill="#dfe7ea"/><path d="M186 133H400M208 116v34M230 116v34M252 116v34M274 116v34M296 116v34M318 116v34M340 116v34M362 116v34M384 116v34" stroke="#c7d3d7"/>
      <rect x="178" y="148" width="232" height="10" fill="#4a4f5c"/>
      <rect x="182" y="158" width="224" height="52" fill="#e9e2d6"/><path d="M238 158v52M294 158v52M350 158v52" stroke="#d1c7b6"/>
      <rect x="226" y="146" width="40" height="5" rx="2" fill="#9aa3ad"/><path d="M246 146v-14h10" fill="none" stroke="#9aa3ad" stroke-width="3"/>
      <rect x="322" y="146" width="54" height="4" fill="#2b2f3a"/><rect x="332" y="130" width="30" height="16" rx="3" fill="#c2412d"/>
      <rect x="90" y="190" width="56" height="10" rx="2" fill="#8a5a3b"/><rect x="96" y="200" width="5" height="34" fill="#6e452c"/><rect x="135" y="200" width="5" height="34" fill="#6e452c"/>`,
    bathroom: `
      <rect x="84" y="160" width="176" height="50" rx="16" fill="#ffffff" stroke="#c9d3d6" stroke-width="2"/>
      <path d="M100 160V92a10 10 0 0 1 20 0" fill="none" stroke="#9aa3ad" stroke-width="3"/><circle cx="120" cy="96" r="5" fill="#9aa3ad"/>
      <ellipse cx="336" cy="98" rx="32" ry="40" fill="#cfe0e8" stroke="#b7c5cb" stroke-width="3"/><path d="M322 80l14-10M318 96l26-18" stroke="#fff" stroke-width="2" opacity=".7"/>
      <rect x="298" y="146" width="76" height="12" rx="5" fill="#fff" stroke="#c9d3d6"/>
      <rect x="304" y="158" width="64" height="50" fill="#a7b8a0"/><path d="M336 158v50" stroke="#93a58c"/>
      <rect x="390" y="172" width="12" height="38" rx="4" fill="#fff" stroke="#c9d3d6"/>
      <rect x="150" y="236" width="80" height="26" rx="10" fill="#7aa3ad" opacity=".55"/>`,
    kids: `${windowSVG(300, 60)}
      <path d="M120 80l5 10 11 1-8 7 2 11-10-6-10 6 2-11-8-7 11-1z" fill="#e8c36a"/><path d="M180 64l3 6 7 1-5 4 1 7-6-4-6 4 1-7-5-4 7-1z" fill="#e59d7a"/>
      <rect x="86" y="150" width="140" height="58" rx="10" fill="#f2ead8"/><rect x="86" y="132" width="14" height="78" rx="5" fill="#8cc6b6"/>
      <path d="M100 176H226L238 214H92Z" fill="#8cc6b6"/><ellipse cx="124" cy="166" rx="18" ry="8" fill="#fff"/>
      <ellipse cx="300" cy="258" rx="90" ry="20" fill="#f3c9a3"/>
      <rect x="262" y="236" width="22" height="22" rx="3" fill="#e05d4f"/><rect x="288" y="240" width="18" height="18" rx="3" fill="#4f86c6"/><rect x="273" y="216" width="20" height="20" rx="3" fill="#e8c36a"/>
      <rect x="360" y="178" width="40" height="32" rx="4" fill="#f5f1ea" stroke="#d8d0c2"/><circle cx="378" cy="170" r="9" fill="#f7c9d4"/><ellipse cx="373" cy="158" rx="3" ry="8" fill="#f7c9d4"/><ellipse cx="383" cy="158" rx="3" ry="8" fill="#f7c9d4"/>`,
    office: `${windowSVG(330, 60, 60, 74)}
      <rect x="84" y="80" width="78" height="130" fill="#8a5a3b"/><rect x="90" y="86" width="66" height="118" fill="#6e452c"/>
      <path d="M90 125H156M90 165H156" stroke="#8a5a3b" stroke-width="4"/>
      <rect x="94" y="96" width="8" height="27" fill="#d9902b"/><rect x="104" y="100" width="7" height="23" fill="#4f86c6"/><rect x="113" y="94" width="9" height="29" fill="#e8e2d6"/><rect x="124" y="99" width="6" height="24" fill="#c2412d"/>
      <rect x="96" y="140" width="10" height="23" fill="#2f8f5b"/><rect x="108" y="136" width="8" height="27" fill="#e8c36a"/><rect x="132" y="146" width="18" height="17" rx="3" fill="#b9714a"/>
      <rect x="196" y="156" width="176" height="8" rx="2" fill="#8a5a3b"/><rect x="204" y="164" width="5" height="50" fill="#6e452c"/><rect x="359" y="164" width="5" height="50" fill="#6e452c"/>
      <rect x="252" y="112" width="74" height="42" rx="3" fill="#2b2f3a"/><rect x="256" y="116" width="66" height="34" fill="#3d5a80"/><rect x="284" y="152" width="10" height="5" fill="#2b2f3a"/>
      <path d="M214 156v-16l12-12" fill="none" stroke="#3a3f4b" stroke-width="3"/><path d="M220 124l14 4-4 10z" fill="#3a3f4b"/>
      <rect x="262" y="176" width="50" height="40" rx="8" fill="#3a3f4b"/><rect x="256" y="210" width="62" height="12" rx="5" fill="#4a4f5c"/><rect x="284" y="222" width="6" height="24" fill="#2b2f3a"/><path d="M266 252h42" stroke="#2b2f3a" stroke-width="4" stroke-linecap="round"/>`,
    hallway: `
      <rect x="204" y="78" width="72" height="132" fill="#8a5a3b"/><rect x="212" y="88" width="56" height="50" fill="#7b4f33"/><rect x="212" y="146" width="56" height="54" fill="#7b4f33"/><circle cx="262" cy="146" r="3.5" fill="#e8c36a"/>
      <path d="M214 212H266L304 300H176Z" fill="#b5523b"/><path d="M220 226H260M214 250H266" stroke="#d9902b" stroke-width="3"/>
      <rect x="118" y="80" width="4" height="130" fill="#3a3f4b"/><path d="M104 92h32" stroke="#3a3f4b" stroke-width="4"/>
      <path d="M106 94c-6 20-6 44 0 60h14V94z" fill="#4f7d4e"/><path d="M130 94c8 18 8 36 2 52h-10V94z" fill="#c2412d"/>
      <rect x="316" y="176" width="78" height="10" rx="3" fill="#8a5a3b"/><rect x="320" y="186" width="5" height="24" fill="#6e452c"/><rect x="385" y="186" width="5" height="24" fill="#6e452c"/>
      <rect x="330" y="200" width="22" height="9" rx="4" fill="#2b2f3a"/><rect x="358" y="200" width="22" height="9" rx="4" fill="#e05d4f"/>
      <ellipse cx="350" cy="110" rx="22" ry="30" fill="#cfe0e8" stroke="#b39066" stroke-width="4"/>`,
    garage: `
      <rect x="84" y="60" width="312" height="150" fill="#c2c2bc"/><path d="M84 90H396M84 120H396M84 150H396M84 180H396" stroke="#b0b0aa" stroke-width="2"/>
      <rect x="350" y="70" width="46" height="60" fill="#d9c8a3"/><path d="M360 80v24M372 80l6 22M386 80v30" stroke="#3a3f4b" stroke-width="3"/>
      <rect x="84" y="150" width="70" height="8" fill="#8a5a3b"/><rect x="90" y="132" width="20" height="18" fill="#c2412d"/><rect x="116" y="138" width="28" height="12" fill="#4f86c6"/>
      <path d="M136 220c4-30 26-44 56-50l30-26c10-8 22-12 36-12h54c18 0 32 8 42 22l14 18c26 4 40 18 42 48z" fill="#3c6e9e"/>
      <path d="M232 148c8-6 16-8 26-8h22v28h-66zM290 140h18c10 0 20 6 26 16l6 12h-50z" fill="#cfe3ef" opacity=".85"/>
      <circle cx="196" cy="222" r="20" fill="#20232b"/><circle cx="196" cy="222" r="9" fill="#9aa3ad"/>
      <circle cx="344" cy="222" r="20" fill="#20232b"/><circle cx="344" cy="222" r="9" fill="#9aa3ad"/>
      <ellipse cx="270" cy="246" rx="150" ry="8" fill="rgba(0,0,0,.15)"/>`,
  };
  return shell + (F[room] || '');
}

function exteriorScene(room) {
  const sky = `<rect width="480" height="300" fill="#1a2550"/>
    <circle cx="410" cy="46" r="16" fill="#efeadb"/><circle cx="403" cy="42" r="16" fill="#1a2550" opacity=".25"/>
    ${[[40, 30], [90, 60], [150, 22], [210, 48], [270, 18], [330, 64], [460, 90], [20, 100], [120, 110]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#fff"/>`).join('')}`;
  if (room === 'entrance') {
    return sky + `
      <rect x="0" y="40" width="480" height="230" fill="#d8cdbd"/><path d="M0 70H480M0 100H480M0 130H480M0 160H480M0 190H480M0 220H480" stroke="#c9bca9" stroke-width="1.5"/>
      <rect x="0" y="30" width="480" height="14" fill="#4a3a2c"/>
      <rect x="62" y="104" width="86" height="72" fill="#2c3550"/><rect x="62" y="104" width="86" height="72" fill="none" stroke="#f5f0e7" stroke-width="5"/><path d="M105 104v72" stroke="#f5f0e7" stroke-width="3"/>
      <rect x="332" y="104" width="86" height="72" fill="#2c3550"/><rect x="332" y="104" width="86" height="72" fill="none" stroke="#f5f0e7" stroke-width="5"/><path d="M375 104v72" stroke="#f5f0e7" stroke-width="3"/>
      <rect x="202" y="108" width="76" height="134" fill="#5b4636"/><rect x="212" y="120" width="56" height="40" fill="#8fa6bf" opacity=".6"/><circle cx="266" cy="190" r="4" fill="#e8c36a"/>
      <rect x="286" y="140" width="20" height="14" rx="2" fill="#f5f0e7"/><text x="296" y="151" font-size="10" text-anchor="middle" fill="#3a3f4b" font-family="Inter, sans-serif" font-weight="700">12</text>
      <rect x="184" y="242" width="112" height="12" fill="#a39b90"/><rect x="172" y="254" width="136" height="12" fill="#b3aba0"/>
      <rect x="0" y="266" width="480" height="34" fill="#8f877c"/>
      <rect x="150" y="214" width="26" height="28" rx="3" fill="#b9714a"/><circle cx="163" cy="204" r="16" fill="#4f7d4e"/>
      <rect x="304" y="214" width="26" height="28" rx="3" fill="#b9714a"/><circle cx="317" cy="204" r="16" fill="#5f9460"/>`;
  }
  // Garden / terrace
  return sky + `
    <path d="M0 170c80-24 160-24 240-10s170 14 240-6v146H0z" fill="#22402a"/>
    ${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 31 + 6}" y="150" width="7" height="40" rx="2" fill="#5b4636"/>`).join('')}
    <path d="M0 162H480M0 178H480" stroke="#5b4636" stroke-width="4"/>
    <path d="M0 192c80-10 160-12 240-6s170 8 240-2v116H0z" fill="#2f5a36"/>
    <path d="M226 192h28l110 108H116z" fill="#9c9282"/><path d="M232 210h16M222 236h36M208 266h64" stroke="#877d6e" stroke-width="3"/>
    <rect x="68" y="120" width="12" height="80" fill="#4a3a2c"/><circle cx="74" cy="110" r="44" fill="#3d6b40"/><circle cx="50" cy="128" r="26" fill="#355f38"/><circle cx="100" cy="126" r="28" fill="#447647"/>
    <circle cx="420" cy="214" r="26" fill="#3d6b40"/><circle cx="446" cy="222" r="20" fill="#447647"/>
    <rect x="370" y="236" width="70" height="8" rx="2" fill="#8a5a3b"/><rect x="376" y="244" width="5" height="22" fill="#6e452c"/><rect x="429" y="244" width="5" height="22" fill="#6e452c"/>
    ${[[205, 230], [180, 262], [282, 230], [312, 262]].map(([x, y]) => `<rect x="${x - 1.5}" y="${y - 2}" width="3" height="18" fill="#2b2f3a"/><path d="M${x} ${y - 12}c4 4 4 9 0 11c-4-2-4-7 0-11z" class="lamp-fx deco"/>`).join('')}`;
}

// Hook up the preview: colours, the on/off switch and the Kelvin "try" slider
function setupPreview(r) {
  // The room is lit straight away; the "switching on" flicker is a CSS animation
  // (class .boot in style.css), so it works even when timers are slowed down.
  applyLight(r, previewK, true);
  $('#scene svg').classList.add('boot');
  const range = $('#kTry');
  range.addEventListener('input', () => {
    previewK = Number(range.value);
    $('#kTryOut').textContent = `${num(previewK)} K`;
    applyLight(r, previewK, lightOn);
  });
}

function applyLight(r, k, isOn) {
  const svg = $('#scene svg');
  if (!svg) return;
  const col = rgb(kelvinRGB(k));
  const b = brightness(r.lux);
  const out = r.room.outdoor;
  svg.querySelectorAll('.k-stop').forEach((s) => s.setAttribute('stop-color', col));
  svg.querySelectorAll('.lamp-fx').forEach((el) => el.setAttribute('fill', isOn ? col : '#8b8f99'));
  const tint = svg.querySelector('.pv-tint');
  tint.setAttribute('fill', col);
  tint.style.opacity = isOn ? (out ? 0.75 : 0.62) : 0;
  // Darkness: indoors the light bounces around, so the whole room brightens a bit
  const dark = svg.querySelector('.pv-dark');
  dark.style.opacity = isOn ? (out ? 0.78 : clamp(0.62 - b * 0.55, 0.06, 0.6)) : (out ? 0.8 : 0.78);
  svg.querySelector('.pv-holes').style.opacity = isOn ? 1 : 0;
  svg.querySelector('.pv-glow').style.opacity = isOn ? (out ? 0.75 : 0.35 + b * 0.35) : 0;
  svg.classList.toggle('is-on', isOn);
}

/* --------------------------------------------------------------------------
   13. RESULT BUTTONS – edit, restart, share, print, switch
   -------------------------------------------------------------------------- */
$('#result').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || !lastResult) return;
  const act = btn.dataset.act;
  if (act === 'toggle') {
    lightOn = !lightOn;
    $('#scene svg').classList.remove('boot');
    btn.setAttribute('aria-pressed', lightOn);
    btn.querySelector('.switch-label').textContent = t(lightOn ? 'r_switch_on' : 'r_switch_off');
    applyLight(lastResult, previewK, lightOn);
  }
  if (act === 'resetK') {
    previewK = lastResult.kelvin;
    $('#kTry').value = previewK;
    $('#kTryOut').textContent = `${num(previewK)} K`;
    applyLight(lastResult, previewK, lightOn);
  }
  if (act === 'edit') { backToQuiz(STEPS.length - 1); }
  if (act === 'restart') { answers = freshAnswers(); backToQuiz(0); }
  if (act === 'print') window.print();
  if (act === 'share') copyText(shareText(lastResult));
});

function backToQuiz(toStep) {
  $('#result').hidden = true;
  $('#result').innerHTML = '';
  $('#quiz').hidden = false;
  lastResult = null;
  history.replaceState(null, '', location.pathname + (lang === 'en' ? '?lang=en' : ''));
  goTo(toStep);
  $('#quiz').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

function shareText(r) {
  const a = r.a;
  const lines = [
    t('share_head', { room: t(`room_${a.room}`), area: num(r.area, 1), mood: moodLabel(a) }),
    '• ' + t('share_lm', { lm: num(r.lumens), lux: r.lux }),
    '• ' + t('share_k', { k: r.kelvin, name: kelvinName(r.kelvin) }),
    '• ' + t('share_ip', { ip: r.ip }),
  ];
  if (r.main) {
    const m = r.main;
    lines.push(`• ${m.pack > 1 ? t('qty_packs', { packs: m.packs, n: m.packs * m.pack }) : pieces(m.units)} · ${m.p.name} – ${eur(m.cost)}`);
    r.extras.forEach((x) => lines.push(`• ${x.p.name}${x.b ? ' + ' + x.b.name : ''} – ${eur(x.cost)}`));
    lines.push('• ' + t('share_total', { total: eur(r.total) }));
    if (!m.solar) lines.push('• ' + t('share_saving', { eur: eur(m.saving) }));
  }
  lines.push('', t('share_link', { url: location.href }));
  return lines.join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('copied'));
  } catch {
    // Fallback for older browsers / non-https
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    ta.remove();
    toast(ok ? t('copied') : t('copy_fail'));
  }
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* --------------------------------------------------------------------------
   14. DEEP LINKS – pre-filled answers in the URL
   ?room=living&l=5&w=4&h=2.6&mood=cozy&fit=e27&smart=0   (indoor)
   ?room=garden&l=8&w=6&mood=everyday&power=0&motion=0    (outdoor)
   #demo=living | bathroom | garage | garden | kitchen | office | entrance
   -------------------------------------------------------------------------- */
const DEMOS = {
  living:   'room=living&l=5&w=4&h=2.6&mood=cozy&fit=none&smart=1',
  bathroom: 'room=bathroom&l=2.5&w=2&h=2.5&mood=everyday&fit=gu10&smart=0',
  garage:   'room=garage&l=6&w=3.5&h=2.6&mood=bright&fit=none&smart=0',
  garden:   'room=garden&l=8&w=6&mood=everyday&power=0&motion=0',
  kitchen:  'room=kitchen&l=4&w=3&h=2.6&mood=everyday&fit=ceiling&smart=0',
  office:   'room=office&l=4&w=3&h=2.7&mood=bright&fit=ceiling&smart=1',
  entrance: 'room=entrance&l=3&w=2&mood=bright&power=1&motion=1',
  bedroom:  'room=bedroom&l=4&w=3.5&h=2.6&mood=cozy&fit=e27&smart=0',
};

function readUrl() {
  const q = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get('demo') && DEMOS[hash.get('demo')]) {
    new URLSearchParams(DEMOS[hash.get('demo')]).forEach((v, k) => q.set(k, v));
  } else {
    hash.forEach((v, k) => q.set(k, v)); // also accept #room=…
  }
  if (q.get('lang') === 'en') lang = 'en';

  const room = q.get('room');
  if (!ROOMS[room]) return false;
  const r = ROOMS[room];
  const n = (k, def, min, max) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? clamp(v, min, max) : def; };
  const bit = (k) => (q.get(k) === '1' ? 1 : q.get(k) === '0' ? 0 : null);
  const maxSide = r.outdoor ? 25 : 12;
  answers = {
    ...freshAnswers(), room,
    l: n('l', r.size[0], 1, maxSide), w: n('w', r.size[1], 1, maxSide), h: n('h', 2.6, 2.2, 4),
    mood: MOODS.includes(q.get('mood')) ? q.get('mood') : null,
    fit: FITTINGS.includes(q.get('fit')) ? q.get('fit') : null,
    smart: bit('smart'), power: bit('power'), motion: bit('motion'),
  };
  const complete = answers.mood && (r.outdoor ? answers.power !== null && answers.motion !== null : answers.fit && answers.smart !== null);
  if (complete) return true;
  // Partly filled → jump to the first unanswered question
  step = !answers.mood ? 1 : 3;
  return false;
}

function updateUrl() {
  const a = answers;
  const p = new URLSearchParams({ room: a.room, l: a.l, w: a.w });
  if (!ROOMS[a.room].outdoor) p.set('h', a.h);
  p.set('mood', a.mood);
  if (ROOMS[a.room].outdoor) { p.set('power', a.power); p.set('motion', a.motion); }
  else { p.set('fit', a.fit); p.set('smart', a.smart); }
  if (lang === 'en') p.set('lang', 'en');
  history.replaceState(null, '', `${location.pathname}?${p}`);
}

/* --------------------------------------------------------------------------
   15. LANGUAGE SWITCH + START
   -------------------------------------------------------------------------- */
function applyStaticTexts() {
  document.documentElement.lang = lang;
  document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  document.querySelectorAll('.lang-switch button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
}

document.querySelectorAll('.lang-switch button').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.lang === lang) return;
  lang = b.dataset.lang;
  applyStaticTexts();
  if (lastResult) showResult(false); else renderStep();
}));

(function start() {
  const ready = readUrl();
  applyStaticTexts();
  if (ready) showResult(false); else renderStep();
})();
