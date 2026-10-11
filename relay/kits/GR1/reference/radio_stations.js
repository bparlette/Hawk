// Excerpt of the game's src/08_radio.js: station ids and names (read-only reference)
  const TRACKS = { day: [T.syc, T.icant, T.bullet, T.back, T.anthem], night: [T.playa, T.hood, T.crash, T.cock, T.para, T.war, T.run],
    ducky: [T.syc, T.bullet, T.crash, T.cock, T.para], lor: [T.icant, T.hood, T.back, T.war, T.took, T.run, T.every, T.anthem],
    club: [T.c1, T.c2, T.c3, T.c4, T.c5, T.c7, T.c9, T.c13, T.c14, T.c17, T.c18, T.c19, T.c29, T.c30],
    rap: [T.c6, T.c8, T.c10, T.c11, T.c12, T.c15, T.c16, T.c20, T.c21, T.c22, T.c23, T.c24, T.c25, T.c26, T.c27, T.c28] };
  const STATIONS = ['remix', 'auto', 'day', 'night', 'ducky', 'lor', 'club', 'rap', 'off'];
  const SNAME = { remix: 'B-MORE 410 REMIX', auto: 'AUTO', day: 'B-MORE 410 DAY', night: 'B-MORE 410 NIGHT', ducky: 'DUCKY DYNAMO FM', lor: 'LOR BITEWHO', club: 'B-MORE CLUB', rap: 'B-MORE RAP', off: 'OFF' };
  const SSHORT = { remix: 'REMIX', auto: 'AUTO', day: 'DAY', night: 'NIGHT', ducky: 'DUCKY FM', lor: 'LOR BITEWHO', club: 'B-MORE CLUB', rap: 'B-MORE RAP', off: 'OFF' };
  const STATION = 'B-MORE 410 RADIO', VOL = 70, FADE = 1.6, BIG_S = 5, LONG_MS = 550, LS = 'tcb_radio_station2'; // new key with REMIX: everyone starts on the new default once, then the dial is remembered
