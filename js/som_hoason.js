/* Hoa Sơn: quái Spell of Mastery (NancyGold, CC-BY 4.0).
   Chạy sau world.js + zones2.js — chỉ đổi roster map Hoa Sơn (id 2), không đụng map khác. */
'use strict';
(function () {
  if (!window.JW) return;
  const META = window.SOM_HOASON;
  if (!META || !META.roster) return;
  JW.anim = JW.anim || {};
  JW.mon = JW.mon || {};
  for (const r of META.roster) {
    JW.anim[r.key] = r.anim;
    JW.mon[r.id] = {
      n: r.n,
      img: r.img,
      sz: r.sz,
      ranged: 0,
      sk: r.sk,
      spd: 18,
      run: r.run,
      rmax: r.rmax,
      anim: r.key,
      faceOnly: 1
    };
  }
  const z = JW.zones && JW.zones.find(x => x.id === 2);
  if (z) {
    z.m = META.zoneMobs.slice();
    z.boss = META.zoneBoss;
  }
})();
