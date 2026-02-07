export interface StaffelTrede {
  tot_exemplaren: number;
  percentage: number;
}

export interface TitelInput {
  titel: string;
  verkoopprijs_incl_btw: number;
  btw_percentage: number;
  boekhandelskorting: number;
  oplage_1e_druk: number;
  drukkosten_1e_druk: number;
  drukkosten_herdruk: number;
  // Eenmalige productie (9 items)
  vormgeving_omslag: number;
  vormgeving_binnenwerk: number;
  dtp: number;
  persklaarmaken: number;
  correctie: number;
  freelance_redactie: number;
  ebook_productie: number;
  audiobook_productie: number;
  overige_productie: number;
  // Offline marketing (6 items)
  evenement: number;
  marketingmateriaal: number;
  offline_campagne: number;
  boekhandelsmateriaal: number;
  marketing_fee: number;
  overige_offline_marketing: number;
  // Online marketing (4 items)
  online_ads: number;
  productfotografie: number;
  productie_ads: number;
  software_kosten: number;
  // Webshop
  transactiekosten_pct: number;
  fulfillment_per_ex: number;
  cac_per_ex: number;
  // Retail/CB
  distributie_cb_per_ex: number;
  // B2B
  b2b_porto_per_ex: number;
  b2b_korting_pct: number;
  // Auteur
  auteur_winstdeling_pct: number;
  auteur_royalty_staffel: StaffelTrede[];
  // Derden
  agent_staffel: StaffelTrede[];
  agent_pct: number;
  vertaler_pct: number;
  illustrator_pct: number;
  // Partnership
  heeft_partner: boolean;
  partner_naam: string;
  // Overige
  overige_kosten_pct: number;
}

export interface CalculateRequest {
  titel_input: TitelInput;
  herdruk_oplages: number[];
  verdeling_webshop: number;
  verdeling_retail: number;
  verdeling_b2b: number;
}

export interface KanaalResultaat {
  kanaal: string;
  verkoopprijs_ex_btw: number;
  korting_bedrag: number;
  netto_omzet: number;
  drukkosten: number;
  productie_per_ex: number;
  offline_marketing_per_ex: number;
  online_marketing_per_ex: number;
  fulfillment: number;
  distributie_cb: number;
  b2b_porto: number;
  transactiekosten: number;
  cac: number;
  vertaler: number;
  illustrator: number;
  agent: number;
  overige_kosten: number;
  totaal_kosten: number;
  brutowinst: number;
  auteur_royalty: number;
  auteur_winstdeling: number;
  partner_winstdeling: number;
  netto_winst_maven: number;
  marge_pct: number;
}

export interface DrukResultaat {
  druk_type: string;
  oplage: number;
  cumulatief_voor_druk: number;
  webshop: KanaalResultaat;
  retail: KanaalResultaat;
  b2b: KanaalResultaat;
  gewogen_marge_pct: number;
  gewogen_netto_winst: number;
}

export interface CalculateResponse {
  titel: string;
  drukken: DrukResultaat[];
  totaal_productie: number;
  totaal_offline_marketing: number;
  totaal_online_marketing: number;
  drukkosten_totaal_1e: number;
}

export interface SensitivityRow {
  variable_value: number;
  webshop_winst: number;
  webshop_marge_pct: number;
  retail_winst: number;
  retail_marge_pct: number;
  b2b_winst: number;
  b2b_marge_pct: number;
  gewogen_winst: number;
  gewogen_marge_pct: number;
}

export interface SensitivityResponse {
  variable_name: string;
  druk_type: string;
  rows: SensitivityRow[];
}

export interface ValidateCheck {
  label: string;
  berekend: number;
  verwacht: number;
  verschil: number;
  ok: boolean;
}

export interface ValidateResponse {
  passed: number;
  total: number;
  all_ok: boolean;
  checks: ValidateCheck[];
}

export const DEFAULT_TITEL_INPUT: TitelInput = {
  titel: '',
  verkoopprijs_incl_btw: 20.0,
  btw_percentage: 0.09,
  boekhandelskorting: 0.48,
  oplage_1e_druk: 2000,
  drukkosten_1e_druk: 1.20,
  drukkosten_herdruk: 1.20,
  // Eenmalige productie
  vormgeving_omslag: 0.0,
  vormgeving_binnenwerk: 0.0,
  dtp: 0.0,
  persklaarmaken: 0.0,
  correctie: 0.0,
  freelance_redactie: 0.0,
  ebook_productie: 0.0,
  audiobook_productie: 0.0,
  overige_productie: 0.0,
  // Offline marketing
  evenement: 0.0,
  marketingmateriaal: 0.0,
  offline_campagne: 0.0,
  boekhandelsmateriaal: 0.0,
  marketing_fee: 0.0,
  overige_offline_marketing: 0.0,
  // Online marketing
  online_ads: 0.0,
  productfotografie: 0.0,
  productie_ads: 0.0,
  software_kosten: 0.0,
  // Webshop
  transactiekosten_pct: 0.02,
  fulfillment_per_ex: 4.50,
  cac_per_ex: 0.0,
  // Retail/CB
  distributie_cb_per_ex: 1.10,
  // B2B
  b2b_porto_per_ex: 0.0,
  b2b_korting_pct: 0.0,
  // Auteur
  auteur_winstdeling_pct: 0.50,
  auteur_royalty_staffel: [],
  // Derden
  agent_staffel: [],
  agent_pct: 0.0,
  vertaler_pct: 0.0,
  illustrator_pct: 0.0,
  // Partnership
  heeft_partner: false,
  partner_naam: '',
  // Overige
  overige_kosten_pct: 0.0,
};
