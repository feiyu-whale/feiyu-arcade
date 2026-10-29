/* 自测：把场景状态挂到 window，方便外部读 */
(function(){
  window.__probe = function(){
    try{
      return JSON.stringify({
        phase: Scene.phase,
        zone: Scene.zone,
        wave: Scene.wave,
        actors: Scene.actors.length,
        heroHp: Scene.hero && Scene.hero.hp,
        heroX: Scene.hero && Math.round(Scene.hero.x),
        shots: Scene.shots.length,
        err: window.__err || null
      });
    }catch(e){ return 'PROBE_ERR:'+e.message+'\n'+(e.stack||''); }
  };
  window.addEventListener('error', function(e){
    window.__err = (e.message||'') + ' @ ' + (e.filename||'') + ':' + (e.lineno||'');
  });
  // 兜底：直接触发开始
  window.__forceStart = function(){
    try{
      document.querySelectorAll('.overlay').forEach(function(o){ o.classList.remove('on'); });
      var hud=document.getElementById('hud'); if(hud) hud.classList.add('on');
      Scene.startRun();
      return 'started:'+Scene.phase;
    }catch(e){ return 'ERR:'+e.message+'\n'+(e.stack||''); }
  };
})();
