// Ortak renk paleti (Unturned'ın mat, doğal tonları)
export const C = {
  steel: '#3a3e45',
  gun: '#4a5059',
  gunLight: '#6c737c',
  black: '#25272b',
  chrome: '#9aa3ad',
  brass: '#b8923a',
  wood: '#8b5a2b',
  woodDark: '#5e3c1d',
  tan: '#a8946a',
  olive: '#4d5b3a',
  oliveDark: '#36422a',
  white: '#e8e8e4',
  red: '#c0392b',
  yellow: '#e0b422',
  lens: '#4fb3ff',
};

export const TEAMS = {
  blue: {
    name: 'Mavi Takım',
    shirt: '#38608c',
    pants: '#2a3d56',
    vest: '#243448',
    helmet: '#2f4d70',
    gloves: '#1d2530',
    boots: '#1b1b1d',
    accent: '#4aa3ff',
  },
  red: {
    name: 'Kırmızı Takım',
    shirt: '#93402f',
    pants: '#4f3328',
    vest: '#5a2a22',
    helmet: '#7d3427',
    gloves: '#2a1c18',
    boots: '#1f1a17',
    accent: '#ff5a43',
  },
};

// Ölüm Maçı (herkes tek): her savaşçının kendi takım kimliği 'f0'..'f31' ve kendi rengi vardır
function hsl2hex(h, sat, l) {
  const a = sat * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
const FFA_HUES = [210, 5, 130, 45, 280, 170, 25, 330, 85, 245];
for (let i = 0; i < 32; i++) {
  const h = (FFA_HUES[i % 10] + Math.floor(i / 10) * 12) % 360;
  TEAMS['f' + i] = { name: 'Ölüm Maçı', shirt: hsl2hex(h, 0.42, 0.36), pants: hsl2hex(h, 0.3, 0.2), vest: hsl2hex(h, 0.36, 0.19), helmet: hsl2hex(h, 0.4, 0.28), gloves: '#1d2530', boots: '#1b1b1d', accent: hsl2hex(h, 0.85, 0.6) };
}

// Enfekte modu: zombiler. Solgun yeşil deri, yırtık kirli giysiler (şapka/yelek yok). Soldier.team 'red' kalır; yalnızca görünüm bu paleti kullanır.
TEAMS.zomb = { name: 'Zombiler', shirt: '#4a5440', pants: '#33372c', vest: '#2d3326', helmet: '#2d3326', gloves: '#7e9a6a', boots: '#1d1d18', accent: '#8dff5a' };

export const SKINS = ['#e3b08a', '#c68b62', '#8d5a3a', '#f2cfae', '#a86f4a'];
