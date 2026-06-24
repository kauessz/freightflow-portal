export interface PortSuggestion {
  name: string;
  unlocode: string;
  country: string;
  timezone: string;
  lat: number;
  lon: number;
}

export const PORTS_DATA: PortSuggestion[] = [
  // ===== BRASIL =====
  { name: "Santos", unlocode: "BRSSZ", country: "BR", timezone: "America/Sao_Paulo", lat: -23.9608, lon: -46.3336 },
  { name: "Rio de Janeiro", unlocode: "BRRIO", country: "BR", timezone: "America/Sao_Paulo", lat: -22.8938, lon: -43.1729 },
  { name: "Paranaguá", unlocode: "BRPNG", country: "BR", timezone: "America/Sao_Paulo", lat: -25.5213, lon: -48.5087 },
  { name: "Itajaí", unlocode: "BRITJ", country: "BR", timezone: "America/Sao_Paulo", lat: -26.9078, lon: -48.6619 },
  { name: "Salvador", unlocode: "BRSSA", country: "BR", timezone: "America/Bahia", lat: -12.9714, lon: -38.5014 },
  { name: "Fortaleza", unlocode: "BRFOR", country: "BR", timezone: "America/Fortaleza", lat: -3.7172, lon: -38.5433 },
  { name: "Manaus", unlocode: "BRMAN", country: "BR", timezone: "America/Manaus", lat: -3.1019, lon: -60.0250 },
  { name: "Belém", unlocode: "BRBEL", country: "BR", timezone: "America/Belem", lat: -1.4558, lon: -48.4902 },
  { name: "Vitória", unlocode: "BRVIX", country: "BR", timezone: "America/Sao_Paulo", lat: -20.3222, lon: -40.3381 },
  { name: "Suape", unlocode: "BRSUA", country: "BR", timezone: "America/Recife", lat: -8.3833, lon: -34.9667 },
  { name: "Navegantes", unlocode: "BRNVT", country: "BR", timezone: "America/Sao_Paulo", lat: -26.8936, lon: -48.6556 },
  { name: "Rio Grande", unlocode: "BRRIG", country: "BR", timezone: "America/Sao_Paulo", lat: -32.0350, lon: -52.1000 },
  // ===== ARGENTINA =====
  { name: "Buenos Aires", unlocode: "ARBUE", country: "AR", timezone: "America/Argentina/Buenos_Aires", lat: -34.5997, lon: -58.3819 },
  { name: "Rosario", unlocode: "ARROS", country: "AR", timezone: "America/Argentina/Buenos_Aires", lat: -32.9587, lon: -60.6930 },
  { name: "Mar del Plata", unlocode: "ARMDQ", country: "AR", timezone: "America/Argentina/Buenos_Aires", lat: -38.0023, lon: -57.5575 },
  // ===== URUGUAI =====
  { name: "Montevideo", unlocode: "UYMVD", country: "UY", timezone: "America/Montevideo", lat: -34.9011, lon: -56.1645 },
  // ===== CHILE =====
  { name: "Valparaíso", unlocode: "CLVAP", country: "CL", timezone: "America/Santiago", lat: -33.0458, lon: -71.6197 },
  { name: "San Antonio", unlocode: "CLSAI", country: "CL", timezone: "America/Santiago", lat: -33.5957, lon: -71.6078 },
  { name: "Iquique", unlocode: "CLIQQ", country: "CL", timezone: "America/Santiago", lat: -20.2208, lon: -70.1431 },
  // ===== PERU =====
  { name: "Callao", unlocode: "PEMCA", country: "PE", timezone: "America/Lima", lat: -12.0565, lon: -77.1311 },
  // ===== COLOMBIA =====
  { name: "Buenaventura", unlocode: "COBUN", country: "CO", timezone: "America/Bogota", lat: 3.8801, lon: -77.0311 },
  { name: "Cartagena", unlocode: "COCTG", country: "CO", timezone: "America/Bogota", lat: 10.3910, lon: -75.4794 },
  // ===== PANAMÁ =====
  { name: "Colón (Manzanillo)", unlocode: "PAEFG", country: "PA", timezone: "America/Panama", lat: 9.3564, lon: -79.9003 },
  { name: "Balboa", unlocode: "PABLB", country: "PA", timezone: "America/Panama", lat: 8.9500, lon: -79.5667 },
  // ===== MÉXICO =====
  { name: "Manzanillo", unlocode: "MXZLO", country: "MX", timezone: "America/Mazatlan", lat: 19.0522, lon: -104.3160 },
  { name: "Veracruz", unlocode: "MXVER", country: "MX", timezone: "America/Mexico_City", lat: 19.2000, lon: -96.1333 },
  { name: "Altamira", unlocode: "MXATM", country: "MX", timezone: "America/Monterrey", lat: 22.4000, lon: -97.9167 },
  { name: "Lázaro Cárdenas", unlocode: "MXLZC", country: "MX", timezone: "America/Mexico_City", lat: 17.9500, lon: -102.2000 },
  // ===== EUA =====
  { name: "New York / New Jersey", unlocode: "USNYC", country: "US", timezone: "America/New_York", lat: 40.6840, lon: -74.0440 },
  { name: "Los Angeles", unlocode: "USLAX", country: "US", timezone: "America/Los_Angeles", lat: 33.7283, lon: -118.2620 },
  { name: "Savannah", unlocode: "USSAV", country: "US", timezone: "America/New_York", lat: 32.1087, lon: -81.1761 },
  { name: "Houston", unlocode: "USHOU", country: "US", timezone: "America/Chicago", lat: 29.7280, lon: -95.2691 },
  { name: "Charleston", unlocode: "USCHS", country: "US", timezone: "America/New_York", lat: 32.7765, lon: -79.9311 },
  { name: "Seattle", unlocode: "USSEA", country: "US", timezone: "America/Los_Angeles", lat: 47.6062, lon: -122.3321 },
  { name: "Long Beach", unlocode: "USLGB", country: "US", timezone: "America/Los_Angeles", lat: 33.7542, lon: -118.2160 },
  { name: "Miami", unlocode: "USMIA", country: "US", timezone: "America/New_York", lat: 25.7617, lon: -80.1918 },
  { name: "Baltimore", unlocode: "USBAL", country: "US", timezone: "America/New_York", lat: 39.2904, lon: -76.6122 },
  { name: "Norfolk", unlocode: "USNFK", country: "US", timezone: "America/New_York", lat: 36.8508, lon: -76.2859 },
  // ===== CANADÁ =====
  { name: "Halifax", unlocode: "CAHAL", country: "CA", timezone: "America/Halifax", lat: 44.6476, lon: -63.5728 },
  { name: "Vancouver", unlocode: "CAVAN", country: "CA", timezone: "America/Vancouver", lat: 49.2827, lon: -123.1207 },
  { name: "Montreal", unlocode: "CAMTR", country: "CA", timezone: "America/Toronto", lat: 45.5017, lon: -73.5673 },
  // ===== EUROPA — NORTE =====
  { name: "Rotterdam", unlocode: "NLRTM", country: "NL", timezone: "Europe/Amsterdam", lat: 51.9225, lon: 4.4792 },
  { name: "Antwerp", unlocode: "BEANR", country: "BE", timezone: "Europe/Brussels", lat: 51.2213, lon: 4.4051 },
  { name: "Hamburg", unlocode: "DEHAM", country: "DE", timezone: "Europe/Berlin", lat: 53.5511, lon: 9.9937 },
  { name: "Bremen / Bremerhaven", unlocode: "DEBRV", country: "DE", timezone: "Europe/Berlin", lat: 53.5396, lon: 8.5809 },
  { name: "Felixstowe", unlocode: "GBFXT", country: "GB", timezone: "Europe/London", lat: 51.9639, lon: 1.3514 },
  { name: "Southampton", unlocode: "GBSOU", country: "GB", timezone: "Europe/London", lat: 50.9097, lon: -1.4044 },
  { name: "London (Tilbury)", unlocode: "GBLON", country: "GB", timezone: "Europe/London", lat: 51.4575, lon: 0.3553 },
  { name: "Le Havre", unlocode: "FRLEH", country: "FR", timezone: "Europe/Paris", lat: 49.4938, lon: 0.1079 },
  { name: "Marseille (Fos)", unlocode: "FRFOS", country: "FR", timezone: "Europe/Paris", lat: 43.4272, lon: 4.9419 },
  { name: "Göteborg", unlocode: "SEGOT", country: "SE", timezone: "Europe/Stockholm", lat: 57.7089, lon: 11.9746 },
  { name: "Gdańsk", unlocode: "PLGDY", country: "PL", timezone: "Europe/Warsaw", lat: 54.3520, lon: 18.6466 },
  { name: "Gdynia", unlocode: "PLGDY", country: "PL", timezone: "Europe/Warsaw", lat: 54.5189, lon: 18.5319 },
  // ===== EUROPA — MED =====
  { name: "Algeciras", unlocode: "ESALG", country: "ES", timezone: "Europe/Madrid", lat: 36.1408, lon: -5.4536 },
  { name: "Barcelona", unlocode: "ESBCN", country: "ES", timezone: "Europe/Madrid", lat: 41.3851, lon: 2.1734 },
  { name: "Valencia", unlocode: "ESVLC", country: "ES", timezone: "Europe/Madrid", lat: 39.4699, lon: -0.3763 },
  { name: "Genoa", unlocode: "ITGOA", country: "IT", timezone: "Europe/Rome", lat: 44.4056, lon: 8.9463 },
  { name: "La Spezia", unlocode: "ITLSP", country: "IT", timezone: "Europe/Rome", lat: 44.1024, lon: 9.8240 },
  { name: "Gioia Tauro", unlocode: "ITGIO", country: "IT", timezone: "Europe/Rome", lat: 38.4243, lon: 15.9003 },
  { name: "Piraeus", unlocode: "GRPIR", country: "GR", timezone: "Europe/Athens", lat: 37.9475, lon: 23.6469 },
  { name: "Izmir", unlocode: "TRIZM", country: "TR", timezone: "Europe/Istanbul", lat: 38.4237, lon: 27.1428 },
  { name: "Istanbul", unlocode: "TRIST", country: "TR", timezone: "Europe/Istanbul", lat: 41.0082, lon: 28.9784 },
  { name: "Odessa", unlocode: "UAODS", country: "UA", timezone: "Europe/Kiev", lat: 46.4825, lon: 30.7233 },
  // ===== ÁFRICA =====
  { name: "Port Said", unlocode: "EGPSD", country: "EG", timezone: "Africa/Cairo", lat: 31.2565, lon: 32.2841 },
  { name: "Alexandria", unlocode: "EGALY", country: "EG", timezone: "Africa/Cairo", lat: 31.2001, lon: 29.9187 },
  { name: "Tanger Med", unlocode: "MAPTM", country: "MA", timezone: "Africa/Casablanca", lat: 35.8833, lon: -5.5000 },
  { name: "Durban", unlocode: "ZADUR", country: "ZA", timezone: "Africa/Johannesburg", lat: -29.8587, lon: 31.0218 },
  { name: "Cape Town", unlocode: "ZACPT", country: "ZA", timezone: "Africa/Johannesburg", lat: -33.9249, lon: 18.4241 },
  { name: "Mombasa", unlocode: "KEMBA", country: "KE", timezone: "Africa/Nairobi", lat: -4.0435, lon: 39.6682 },
  { name: "Lagos (Apapa)", unlocode: "NGAPP", country: "NG", timezone: "Africa/Lagos", lat: 6.4500, lon: 3.3667 },
  // ===== ORIENTE MÉDIO =====
  { name: "Dubai (Jebel Ali)", unlocode: "AEDXB", country: "AE", timezone: "Asia/Dubai", lat: 25.0657, lon: 55.1713 },
  { name: "Abu Dhabi (Khalifa)", unlocode: "AEAUH", country: "AE", timezone: "Asia/Dubai", lat: 24.8029, lon: 54.6451 },
  { name: "Salalah", unlocode: "OMSAL", country: "OM", timezone: "Asia/Muscat", lat: 16.9742, lon: 54.0088 },
  // ===== SUBCONTINENTE =====
  { name: "Mumbai (JNPT)", unlocode: "INBOM", country: "IN", timezone: "Asia/Kolkata", lat: 18.9548, lon: 72.9427 },
  { name: "Chennai", unlocode: "INMAA", country: "IN", timezone: "Asia/Kolkata", lat: 13.0827, lon: 80.2707 },
  { name: "Colombo", unlocode: "LKCMB", country: "LK", timezone: "Asia/Colombo", lat: 6.9271, lon: 79.8612 },
  { name: "Chittagong", unlocode: "BDCGP", country: "BD", timezone: "Asia/Dhaka", lat: 22.3419, lon: 91.8152 },
  // ===== SUDESTE ASIÁTICO =====
  { name: "Singapore", unlocode: "SGSIN", country: "SG", timezone: "Asia/Singapore", lat: 1.2897, lon: 103.8631 },
  { name: "Port Klang", unlocode: "MYKUL", country: "MY", timezone: "Asia/Kuala_Lumpur", lat: 3.0000, lon: 101.4000 },
  { name: "Tanjung Pelepas", unlocode: "MYTPP", country: "MY", timezone: "Asia/Kuala_Lumpur", lat: 1.3667, lon: 103.5500 },
  { name: "Tanjung Priok (Jakarta)", unlocode: "IDTPP", country: "ID", timezone: "Asia/Jakarta", lat: -6.1000, lon: 106.8833 },
  { name: "Manila", unlocode: "PHMNL", country: "PH", timezone: "Asia/Manila", lat: 14.5995, lon: 120.9842 },
  { name: "Ho Chi Minh City", unlocode: "VNSGN", country: "VN", timezone: "Asia/Ho_Chi_Minh", lat: 10.7769, lon: 106.7009 },
  { name: "Bangkok (Laem Chabang)", unlocode: "THBKK", country: "TH", timezone: "Asia/Bangkok", lat: 13.0827, lon: 100.8800 },
  // ===== LESTE ASIÁTICO =====
  { name: "Shanghai", unlocode: "CNSHA", country: "CN", timezone: "Asia/Shanghai", lat: 31.2304, lon: 121.4737 },
  { name: "Ningbo-Zhoushan", unlocode: "CNNGB", country: "CN", timezone: "Asia/Shanghai", lat: 29.8683, lon: 121.5440 },
  { name: "Shenzhen (Yantian)", unlocode: "CNSZX", country: "CN", timezone: "Asia/Shanghai", lat: 22.5431, lon: 114.0579 },
  { name: "Guangzhou (Nansha)", unlocode: "CNGZU", country: "CN", timezone: "Asia/Shanghai", lat: 22.7964, lon: 113.5664 },
  { name: "Qingdao", unlocode: "CNTAO", country: "CN", timezone: "Asia/Shanghai", lat: 36.0671, lon: 120.3826 },
  { name: "Tianjin", unlocode: "CNTSN", country: "CN", timezone: "Asia/Shanghai", lat: 38.9900, lon: 117.7200 },
  { name: "Hong Kong", unlocode: "HKHKG", country: "HK", timezone: "Asia/Hong_Kong", lat: 22.3193, lon: 114.1694 },
  { name: "Kaohsiung", unlocode: "TWKHH", country: "TW", timezone: "Asia/Taipei", lat: 22.6273, lon: 120.3014 },
  { name: "Keelung", unlocode: "TWKEL", country: "TW", timezone: "Asia/Taipei", lat: 25.1313, lon: 121.7401 },
  { name: "Busan", unlocode: "KRPUS", country: "KR", timezone: "Asia/Seoul", lat: 35.1796, lon: 129.0756 },
  { name: "Incheon", unlocode: "KRINC", country: "KR", timezone: "Asia/Seoul", lat: 37.4563, lon: 126.7052 },
  { name: "Yokohama", unlocode: "JPYOK", country: "JP", timezone: "Asia/Tokyo", lat: 35.4437, lon: 139.6380 },
  { name: "Tokyo", unlocode: "JPTYO", country: "JP", timezone: "Asia/Tokyo", lat: 35.6762, lon: 139.6503 },
  { name: "Osaka", unlocode: "JPOSA", country: "JP", timezone: "Asia/Tokyo", lat: 34.6937, lon: 135.5023 },
  { name: "Kobe", unlocode: "JPUKB", country: "JP", timezone: "Asia/Tokyo", lat: 34.6901, lon: 135.1956 },
  // ===== OCEANIA =====
  { name: "Auckland", unlocode: "NZAKL", country: "NZ", timezone: "Pacific/Auckland", lat: -36.8509, lon: 174.7645 },
  { name: "Brisbane", unlocode: "AUBNE", country: "AU", timezone: "Australia/Brisbane", lat: -27.4698, lon: 153.0251 },
  { name: "Sydney", unlocode: "AUSYD", country: "AU", timezone: "Australia/Sydney", lat: -33.8688, lon: 151.2093 },
  { name: "Melbourne", unlocode: "AUMEL", country: "AU", timezone: "Australia/Melbourne", lat: -37.8136, lon: 144.9631 },
  { name: "Fremantle", unlocode: "AUFRE", country: "AU", timezone: "Australia/Perth", lat: -32.0569, lon: 115.7440 },
];

export function searchPorts(query: string): PortSuggestion[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return PORTS_DATA.filter(
    (p) => p.name.toLowerCase().includes(q) || p.unlocode.toLowerCase().includes(q)
  ).slice(0, 8);
}
