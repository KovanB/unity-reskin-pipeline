// React -> Unity message bridge
window.addEventListener("message",function(e){if(e.data&&e.data.source==="react"&&window._ub){var p=e.data.payload;if(p.gameObject&&p.method)window._ub.SendMessage(p.gameObject,p.method,p.data||"")}});

// Arrow key controls — simulate touch swipes since keyboard input
// is compiled out for WebGL in Trash Dash's CharacterInputController
(function(){
  var canvas;
  function getCanvas(){
    canvas = document.getElementById("unity-canvas");
    if(!canvas) setTimeout(getCanvas, 300);
  }
  getCanvas();

  function simulateSwipe(dx, dy){
    if(!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var cx = rect.left + rect.width/2;
    var cy = rect.top + rect.height/2;
    // Swipe distance needs to be >1% of canvas width
    var dist = Math.max(rect.width * 0.05, 30);

    var opts = function(x,y){ return {
      clientX:x, clientY:y, bubbles:true, cancelable:true,
      pointerId:1, pointerType:"touch", isPrimary:true,
      button:0, buttons:1, width:1, height:1, pressure:0.5
    }};

    canvas.dispatchEvent(new PointerEvent("pointerdown", opts(cx, cy)));
    canvas.dispatchEvent(new MouseEvent("mousedown", {clientX:cx, clientY:cy, bubbles:true, button:0}));

    setTimeout(function(){
      var ex = cx + dx*dist, ey = cy + dy*dist;
      canvas.dispatchEvent(new PointerEvent("pointermove", opts(ex, ey)));
      canvas.dispatchEvent(new MouseEvent("mousemove", {clientX:ex, clientY:ey, bubbles:true, button:0}));

      setTimeout(function(){
        canvas.dispatchEvent(new PointerEvent("pointerup", opts(ex, ey)));
        canvas.dispatchEvent(new MouseEvent("mouseup", {clientX:ex, clientY:ey, bubbles:true, button:0}));
      }, 20);
    }, 20);
  }

  // Also simulate a simple tap (for menus / tutorial advance)
  function simulateTap(){
    if(!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var cx = rect.left + rect.width/2;
    var cy = rect.top + rect.height/2;
    canvas.dispatchEvent(new PointerEvent("pointerdown", {clientX:cx,clientY:cy,bubbles:true,pointerId:1,pointerType:"touch",isPrimary:true,button:0,buttons:1,pressure:0.5}));
    canvas.dispatchEvent(new MouseEvent("mousedown", {clientX:cx,clientY:cy,bubbles:true,button:0}));
    setTimeout(function(){
      canvas.dispatchEvent(new PointerEvent("pointerup", {clientX:cx,clientY:cy,bubbles:true,pointerId:1,pointerType:"touch",isPrimary:true,button:0}));
      canvas.dispatchEvent(new MouseEvent("mouseup", {clientX:cx,clientY:cy,bubbles:true,button:0}));
    }, 50);
  }

  document.addEventListener("keydown", function(e){
    // Only handle if no text input is focused
    if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;

    switch(e.key){
      case "ArrowLeft":  e.preventDefault(); simulateSwipe(-1, 0); break;
      case "ArrowRight": e.preventDefault(); simulateSwipe(1, 0);  break;
      case "ArrowUp":    e.preventDefault(); simulateSwipe(0, -1); break;
      case "ArrowDown":  e.preventDefault(); simulateSwipe(0, 1);  break;
      case "Enter":
      case " ":          e.preventDefault(); simulateTap();        break;
    }
  });

  // Auto-focus canvas
  window.addEventListener("load", function(){
    setTimeout(function(){ if(canvas) canvas.focus(); }, 1000);
  });

  // Skip splash screen: call StartButton.StartGame() to load the main scene.
  // The Start scene has a "StartButton" GameObject with StartGame() that calls
  // SceneManager.LoadScene("main"). We try multiple possible GameObject names.
  function skipSplash(){
    if(!window._ub) { setTimeout(skipSplash, 500); return; }
    var names = ["StartButton", "Start Button", "PlayButton", "BtnStart", "Button"];
    for(var i=0; i<names.length; i++){
      window._ub.SendMessage(names[i], "StartGame", "");
    }
    // Also try LevelLoader as fallback
    window._ub.SendMessage("LevelLoader", "LoadLevel", "main");
    console.log("[Bridge] Sent StartGame to skip splash screen");
  }
  // Wait for Unity to finish loading, then skip
  setTimeout(skipSplash, 3000);
  setTimeout(skipSplash, 5000);
  setTimeout(skipSplash, 8000);
})();

// Skip tutorial — pre-populate save.bin in IndexedDB before Unity reads it
(function(){
  // Unity WebGL persistentDataPath = /idbfs/{company}/{product}
  // For Trash Dash: /idbfs/Unity/Trash Dash/save.bin
  var DB_NAME = "/idbfs";
  var STORE = "FILE_DATA";
  var SAVE_PATH = "/idbfs/Unity/Trash Dash/save.bin";

  function buildMinimalSave(){
    // Binary format from PlayerData.cs (version 12):
    // int32 version, int32 coins, int32 consumables.Count,
    // int32 characters.Count, [strings...],
    // int32 usedCharacter, int32 accessories.Count,
    // int32 themes.Count, [strings...], int32 usedTheme,
    // int32 premium, int32 highscores.Count,
    // int32 missions.Count,
    // string previousName, bool licenceAccepted,
    // float masterVol, float musicVol, float sfxVol,
    // int32 ftueLevel, int32 rank, bool tutorialDone
    var buf = [];
    function writeInt32(v){ buf.push(v&0xff,(v>>8)&0xff,(v>>16)&0xff,(v>>24)&0xff); }
    function writeFloat(v){ var a=new Float32Array([v]); var b=new Uint8Array(a.buffer); for(var i=0;i<4;i++) buf.push(b[i]); }
    function writeBool(v){ buf.push(v?1:0); }
    function writeString(s){
      // BinaryWriter writes 7-bit encoded length prefix then UTF-8 bytes
      var bytes = new TextEncoder().encode(s);
      var len = bytes.length;
      while(len > 0x7f){ buf.push((len&0x7f)|0x80); len >>= 7; }
      buf.push(len&0x7f);
      for(var i=0;i<bytes.length;i++) buf.push(bytes[i]);
    }

    writeInt32(12);          // version = 12
    writeInt32(0);           // coins = 0
    writeInt32(0);           // consumables.Count = 0
    writeInt32(1);           // characters.Count = 1
    writeString("Trash Cat");// default character
    writeInt32(0);           // usedCharacter = 0
    writeInt32(0);           // characterAccessories.Count = 0
    writeInt32(1);           // themes.Count = 1
    writeString("Day");      // default theme
    writeInt32(0);           // usedTheme = 0
    writeInt32(0);           // premium = 0
    writeInt32(0);           // highscores.Count = 0
    writeInt32(0);           // missions.Count = 0
    writeString("Trash Cat");// previousName
    writeBool(true);         // licenceAccepted
    writeFloat(1.0);         // masterVolume
    writeFloat(1.0);         // musicVolume
    writeFloat(1.0);         // masterSFXVolume
    writeInt32(3);           // ftueLevel = 3 (fully completed)
    writeInt32(0);           // rank = 0
    writeBool(true);         // tutorialDone = true!

    return new Uint8Array(buf);
  }

  // Check if save already exists; if not, write the tutorial-skip save
  var req = indexedDB.open(DB_NAME);
  req.onupgradeneeded = function(e){
    var db = e.target.result;
    if(!db.objectStoreNames.contains(STORE)){
      db.createObjectStore(STORE);
    }
  };
  req.onsuccess = function(e){
    var db = e.target.result;
    if(!db.objectStoreNames.contains(STORE)){ db.close(); return; }
    var tx = db.transaction(STORE, "readwrite");
    var store = tx.objectStore(STORE);
    var getReq = store.get(SAVE_PATH);
    getReq.onsuccess = function(){
      if(!getReq.result){
        // No save exists — write tutorial-skip save
        var saveData = buildMinimalSave();
        var record = {
          timestamp: new Date(),
          mode: 33206, // regular file permissions
          contents: saveData
        };
        store.put(record, SAVE_PATH);
        console.log("[Bridge] Wrote tutorial-skip save (" + saveData.length + " bytes)");
      } else {
        console.log("[Bridge] Save already exists, not overwriting");
      }
    };
    tx.oncomplete = function(){ db.close(); };
  };
})();
