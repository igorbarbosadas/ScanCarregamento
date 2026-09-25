(function () {
  "use strict";

  function $(s){ return document.querySelector(s); }

  var fileInput = $("#fileInput");
  var dropZone = $("#dropZone");
  var progressBox = $("#progressBox");
  var progressText = $("#progressText");
  var progressCount = $("#progressCount");
  var progressBar = $("#progressBar");
  var resultsSection = $("#resultsSection");
  var resultsBody = $("#resultsBody");
  var rowTemplate = $("#rowTemplate");
  var zipBtn = $("#zipBtn");
  var clearBtn = $("#clearBtn");
  var errorBox = $("#errorBox");

  var confirmModal = $("#confirmModal");
  var reportPlateValue = $("#reportPlateValue");
  var mapPlateValue = $("#mapPlateValue");
  var manualPlate = $("#manualPlate");
  var modalFileName = $("#modalFileName");
  var pdfCanvas = $("#pdfCanvas");
  var pdfCanvasWrap = $("#pdfCanvasWrap");
  var previewFallback = $("#previewFallback");
  var prevPage = $("#prevPage");
  var nextPage = $("#nextPage");
  var pageInfo = $("#pageInfo");

  var records = [];
  var rowRefreshers = {};
  var pendingRecord = null;
  var previewPdf = null;
  var previewPageNum = 1;

  function showError(msg){
    errorBox.textContent = msg;
    errorBox.classList.remove("hidden");
  }

  function clearError(){
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
  }

  if (!fileInput || !resultsBody || !confirmModal || !pdfCanvas) {
    alert("Erro ao carregar a interface. Atualize a página.");
    return;
  }

  if (typeof pdfjsLib === "undefined") {
    showError("A biblioteca de leitura de PDF não carregou. Verifique sua conexão e atualize a página.");
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  fileInput.addEventListener("change", function(){
    handleFiles(Array.prototype.slice.call(fileInput.files || []));
  });

  dropZone.addEventListener("click", function(e){
    if (e.target.closest("label")) return;
    fileInput.click();
  });

  ["dragenter","dragover"].forEach(function(evt){
    dropZone.addEventListener(evt, function(e){
      e.preventDefault();
      dropZone.classList.add("drag");
    });
  });

  ["dragleave","drop"].forEach(function(evt){
    dropZone.addEventListener(evt, function(e){
      e.preventDefault();
      dropZone.classList.remove("drag");
    });
  });

  dropZone.addEventListener("drop", function(e){
    handleFiles(Array.prototype.slice.call(e.dataTransfer.files || []));
  });

  clearBtn.addEventListener("click", function(){
    records = [];
    rowRefreshers = {};
    resultsBody.innerHTML = "";
    resultsSection.classList.add("hidden");
    progressBox.classList.add("hidden");
    fileInput.value = "";
    clearError();
  });

  zipBtn.addEventListener("click", downloadZip);

  resultsBody.addEventListener("click", function(e){
    var previewBtn = e.target.closest(".preview-btn");
    if (previewBtn) {
      e.preventDefault();
      var row = previewBtn.closest("tr");
      if (!row) return;
      var rec = records.find(function(r){ return r.id === row.dataset.id; });
      if (!rec) return;
      openPopup(rec);
      return;
    }
  });

  confirmModal.addEventListener("click", function(e){
    var target = e.target;

    if (target === confirmModal) {
      closePopup();
      return;
    }

    if (target.closest("#closeModalX") || target.closest("#cancelModal")) {
      e.preventDefault();
      closePopup();
      return;
    }

    if (target.closest("#chooseReport")) {
      e.preventDefault();
      if (pendingRecord && pendingRecord.reportPlate) {
        confirmPlate(pendingRecord.reportPlate);
      } else {
        alert("A placa do relatório não foi identificada.");
      }
      return;
    }

    if (target.closest("#chooseMap")) {
      e.preventDefault();
      if (pendingRecord && pendingRecord.mapPlate) {
        confirmPlate(pendingRecord.mapPlate);
      } else {
        alert("A placa do mapa não foi identificada.");
      }
      return;
    }

    if (target.closest("#confirmManual")) {
      e.preventDefault();
      confirmPlate(manualPlate.value);
      return;
    }

    if (target.closest("#prevPage")) {
      e.preventDefault();
      if (previewPdf && previewPageNum > 1) {
        previewPageNum--;
        renderPreviewPage();
      }
      return;
    }

    if (target.closest("#nextPage")) {
      e.preventDefault();
      if (previewPdf && previewPageNum < previewPdf.numPages) {
        previewPageNum++;
        renderPreviewPage();
      }
    }
  });

  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && !confirmModal.classList.contains("hidden")) {
      closePopup();
    }
  });

  async function handleFiles(files){
    clearError();

    files = files.filter(function(f){
      return f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    });

    if (!files.length) {
      showError("Selecione pelo menos um arquivo PDF.");
      return;
    }

    resultsSection.classList.remove("hidden");
    progressBox.classList.remove("hidden");

    for (var i=0; i<files.length; i++) {
      var file = files[i];
      setProgress(i, files.length, "Analisando " + file.name + "...");

      try {
        var result = await analyzePdf(file, function(msg){
          progressText.textContent = msg;
        });
        addRecord(Object.assign({file:file}, result));
      } catch (err) {
        console.error(err);
        addRecord({
          file:file,
          reportPlate:"",
          mapPlate:"",
          date:"",
          confidence:"error",
          message:"Não foi possível ler"
        });
      }
    }

    setProgress(files.length, files.length, "Processamento concluído");
    setTimeout(function(){ progressBox.classList.add("hidden"); }, 900);
    fileInput.value = "";
  }

  function setProgress(done,total,text){
    progressText.textContent = text;
    progressCount.textContent = done + "/" + total;
    progressBar.style.width = Math.round((done/total)*100) + "%";
  }

  async function analyzePdf(file,onStatus){
    var buffer = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({data:buffer}).promise;

    var reportPlate = "";
    var mapPlate = "";
    var printedDate = "";

    for (var pageNo=1; pageNo<=pdf.numPages; pageNo++){
      onStatus("Identificando página " + pageNo + " de " + pdf.numPages + " · " + file.name);

      var page = await pdf.getPage(pageNo);
      var embedded = "";

      try {
        var content = await page.getTextContent();
        embedded = content.items.map(function(i){ return i.str; }).join(" ");
      } catch(e){}

      var embeddedNorm = normalize(embedded);

      if (isReportPage(embeddedNorm) && !reportPlate) {
        reportPlate = extractReportPlate(embeddedNorm);

        if (!reportPlate) {
          var reportText = await ocrRegion(page, {
            x:0.03, y:0.07, w:0.60, h:0.30, scale:2.6
          }, onStatus, "placa do relatório");

          reportPlate = extractReportPlate(normalize(reportText)) ||
                        extractAnyPlate(normalize(reportText));
        }
      }

      if (isMapPage(embeddedNorm)) {
        if (!mapPlate) {
          mapPlate = extractMapPlate(embeddedNorm);
        }

        if (!printedDate) {
          printedDate = extractPrintedDate(embeddedNorm);
        }

        if (!mapPlate) {
          var mapTopText = await ocrRegion(page, {
            x:0.54, y:0.00, w:0.44, h:0.22, scale:2.6
          }, onStatus, "placa do mapa");

          mapPlate = extractMapPlate(normalize(mapTopText)) ||
                     extractAnyPlate(normalize(mapTopText));
        }

        if (!printedDate) {
          var mapBottomText = await ocrRegion(page, {
            x:0.02, y:0.80, w:0.96, h:0.19, scale:2.6
          }, onStatus, "data de impressão");

          printedDate = extractPrintedDate(normalize(mapBottomText)) ||
                        extractAnyDate(normalize(mapBottomText));
        }
      }

      if (!isReportPage(embeddedNorm) && !isMapPage(embeddedNorm)) {
        var headerText = await ocrRegion(page, {
          x:0.02, y:0.00, w:0.96, h:0.34, scale:1.9
        }, onStatus, "cabeçalho");

        var headerNorm = normalize(headerText);

        if (isReportPage(headerNorm) && !reportPlate) {
          reportPlate = extractReportPlate(headerNorm);

          if (!reportPlate) {
            var plateZone = await ocrRegion(page, {
              x:0.05, y:0.12, w:0.43, h:0.18, scale:3.0
            }, onStatus, "campo placa do relatório");

            reportPlate = extractReportPlate(normalize(plateZone)) ||
                          extractAnyPlate(normalize(plateZone));
          }
        }

        if (isMapPage(headerNorm)) {
          if (!mapPlate) {
            mapPlate = extractMapPlate(headerNorm);

            if (!mapPlate) {
              var mapPlateZone = await ocrRegion(page, {
                x:0.54, y:0.00, w:0.44, h:0.22, scale:3.0
              }, onStatus, "campo veículo/placa");

              mapPlate = extractMapPlate(normalize(mapPlateZone)) ||
                         extractAnyPlate(normalize(mapPlateZone));
            }
          }

          if (!printedDate) {
            var bottomZone = await ocrRegion(page, {
              x:0.02, y:0.80, w:0.96, h:0.19, scale:2.8
            }, onStatus, "linha impresso por");

            printedDate = extractPrintedDate(normalize(bottomZone)) ||
                          extractAnyDate(normalize(bottomZone));
          }
        }
      }

      if (reportPlate && mapPlate && printedDate) break;
    }

    var confidence = "warn";
    var message = "Revisão necessária";

    if (reportPlate && mapPlate && printedDate) {
      if (reportPlate === mapPlate) {
        confidence = "ok";
        message = "Placas conferem";
      } else {
        confidence = "warn";
        message = "Confirmar divergência";
      }
    } else if (!reportPlate) {
      message = "Placa do relatório não encontrada";
    } else if (!printedDate) {
      message = "Data não encontrada";
    } else if (!mapPlate) {
      message = "Mapa sem placa";
    }

    return {
      reportPlate:reportPlate,
      mapPlate:mapPlate,
      date:printedDate,
      confidence:confidence,
      message:message
    };
  }

  async function ocrRegion(page, region, onStatus, label){
    if (typeof Tesseract === "undefined") {
      throw new Error("Tesseract não carregou");
    }

    var viewport = page.getViewport({scale:region.scale || 2.4});
    var full = document.createElement("canvas");
    var fullCtx = full.getContext("2d",{willReadFrequently:true});

    full.width = Math.floor(viewport.width);
    full.height = Math.floor(viewport.height);

    await page.render({canvasContext:fullCtx, viewport:viewport}).promise;

    var sx = Math.floor(full.width * region.x);
    var sy = Math.floor(full.height * region.y);
    var sw = Math.floor(full.width * region.w);
    var sh = Math.floor(full.height * region.h);

    var crop = document.createElement("canvas");
    crop.width = sw;
    crop.height = sh;

    var ctx = crop.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);

    var result = await Tesseract.recognize(crop,"por",{
      logger:function(m){
        if (m.status === "recognizing text" && onStatus) {
          onStatus("OCR " + label + " · " + Math.round((m.progress||0)*100) + "%");
        }
      }
    });

    return (result && result.data && result.data.text) || "";
  }

  function normalize(s){
    return (s||"")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/[|]/g,"/")
      .replace(/\s+/g," ")
      .toUpperCase();
  }

  function isReportPage(t){
    return t.indexOf("RELATORIO DE CARREGAMENTO") >= 0 ||
      (t.indexOf("ARMAZEM SAO PAULO") >= 0 && t.indexOf("MOTORISTA") >= 0 && t.indexOf("PLACA") >= 0);
  }

  function isMapPage(t){
    return t.indexOf("MAPA DE CARREGAMENTO") >= 0 ||
      (t.indexOf("VEICULO/PLACA") >= 0 && t.indexOf("ORDEM DE FRETE") >= 0);
  }

  function isBrazilianPlate(s){
    return /^[A-Z]{3}\d{4}$/.test(s) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(s);
  }

  function variants(raw){
    var s = (raw||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
    var arr = [s];

    if (s.length === 7) {
      var a = s.split("");

      for (var i=0; i<3; i++) {
        a[i] = a[i].replace("0","O").replace("1","I").replace("5","S").replace("8","B");
      }

      var merc = a.slice();
      merc[3] = merc[3].replace("O","0").replace("I","1").replace("S","5").replace("B","8");
      merc[4] = merc[4].replace("0","O").replace("1","I").replace("5","S").replace("8","B");
      merc[5] = merc[5].replace("O","0").replace("I","1").replace("S","5").replace("B","8");
      merc[6] = merc[6].replace("O","0").replace("I","1").replace("S","5").replace("B","8");

      var old = a.slice();
      for (var j=3; j<7; j++) {
        old[j] = old[j].replace("O","0").replace("I","1").replace("S","5").replace("B","8");
      }

      arr.push(merc.join(""));
      arr.push(old.join(""));
    }

    return Array.from(new Set(arr));
  }

  function extractAnyPlate(t){
    var raw = t.match(/\b[A-Z0-9]{7}\b/g) || [];

    for (var i=0; i<raw.length; i++) {
      var v = variants(raw[i]);
      for (var j=0; j<v.length; j++) {
        if (isBrazilianPlate(v[j])) return v[j];
      }
    }

    return "";
  }

  function extractReportPlate(t){
    var pos = t.indexOf("PLACA");
    var zone = pos >= 0 ? t.slice(pos, pos+280) : t;
    return extractAnyPlate(zone);
  }

  function extractMapPlate(t){
    var pos = t.indexOf("VEICULO/PLACA");
    var zone = pos >= 0 ? t.slice(pos, pos+300) : t;
    return extractAnyPlate(zone);
  }

  function extractPrintedDate(t){
    var pos = t.indexOf("IMPRESSO POR");
    if (pos < 0) pos = t.indexOf("IMPRESSOPOR");
    if (pos < 0) return "";

    return extractAnyDate(t.slice(pos,pos+260));
  }

  function extractAnyDate(t){
    var m = t.match(/(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})/);
    return m ? (m[1]+"/"+m[2]+"/"+m[3]) : "";
  }

  function uid(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function addRecord(data){
    var rec = {
      id:uid(),
      file:data.file,
      reportPlate:(data.reportPlate||"").toUpperCase(),
      mapPlate:(data.mapPlate||"").toUpperCase(),
      date:data.date||"",
      confidence:data.confidence||"warn",
      message:data.message||"Revisar",
      userConfirmed:false
    };

    records.push(rec);

    var row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = rec.id;

    var plateInput = row.querySelector(".plate-input");
    var dateInput = row.querySelector(".date-input");
    var mapPlateCell = row.querySelector(".map-plate");
    var status = row.querySelector(".status");
    var newName = row.querySelector(".new-name");

    row.querySelector(".original").textContent = rec.file.name;
    plateInput.value = rec.reportPlate;
    dateInput.value = rec.date;
    mapPlateCell.textContent = rec.mapPlate || "Não encontrada";

    function refresh(forcedPlate){
      if (forcedPlate) {
        plateInput.value = forcedPlate;
      }

      rec.reportPlate = plateInput.value.toUpperCase().replace(/[^A-Z0-9]/g,"");
      rec.date = dateInput.value.trim();

      status.classList.remove("ok","warn","error");

      if (rec.userConfirmed) {
        status.textContent = "Confirmado";
        status.classList.add("ok");
      } else if (rec.reportPlate && rec.mapPlate) {
        if (rec.reportPlate === rec.mapPlate) {
          status.textContent = "Placas conferem";
          status.classList.add("ok");
        } else {
          status.textContent = "Confirmar divergência";
          status.classList.add("warn");
        }
      } else {
        status.textContent = rec.message;
        status.classList.add(rec.confidence);
      }

      newName.textContent = makeName(rec) || "Preencha placa e data";
    }

    plateInput.addEventListener("input", refresh);
    dateInput.addEventListener("input", refresh);

    row.querySelector(".download-btn").addEventListener("click", function(){
      downloadOne(rec);
    });

    rowRefreshers[rec.id] = refresh;
    refresh();
    resultsBody.appendChild(row);
  }

  async function openPopup(rec){
    pendingRecord = rec;

    reportPlateValue.textContent = rec.reportPlate || "Não encontrada";
    mapPlateValue.textContent = rec.mapPlate || "Não encontrada";
    modalFileName.textContent = rec.file ? rec.file.name : "";
    manualPlate.value = rec.reportPlate || "";

    confirmModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    previewFallback.classList.add("hidden");
    pdfCanvasWrap.classList.remove("hidden");
    pageInfo.textContent = "Carregando PDF...";
    prevPage.disabled = true;
    nextPage.disabled = true;

    try {
      var buffer = await rec.file.arrayBuffer();
      previewPdf = await pdfjsLib.getDocument({data:buffer}).promise;
      previewPageNum = 1;
      await renderPreviewPage();
    } catch (e) {
      console.error(e);
      pdfCanvasWrap.classList.add("hidden");
      previewFallback.classList.remove("hidden");
      pageInfo.textContent = "PDF indisponível";
    }
  }

  function closePopup(){
    confirmModal.classList.add("hidden");
    document.body.style.overflow = "";
    pendingRecord = null;
    previewPdf = null;
    previewPageNum = 1;
  }

  function confirmPlate(value){
    if (!pendingRecord) return;

    var plate = (value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");

    if (!isBrazilianPlate(plate)) {
      alert("Informe uma placa válida.");
      return;
    }

    pendingRecord.reportPlate = plate;
    pendingRecord.userConfirmed = true;

    var refresh = rowRefreshers[pendingRecord.id];
    if (refresh) refresh(plate);

    closePopup();
  }

  async function renderPreviewPage(){
    if (!previewPdf) return;

    var page = await previewPdf.getPage(previewPageNum);
    var baseViewport = page.getViewport({scale:1});
    var available = Math.min(1050, Math.max(320, (pdfCanvasWrap.clientWidth || 900)-36));
    var scale = Math.max(0.7, Math.min(available/baseViewport.width, 2.0));
    var viewport = page.getViewport({scale:scale});

    pdfCanvas.width = Math.floor(viewport.width);
    pdfCanvas.height = Math.floor(viewport.height);

    await page.render({
      canvasContext:pdfCanvas.getContext("2d"),
      viewport:viewport
    }).promise;

    pageInfo.textContent = "Página " + previewPageNum + " de " + previewPdf.numPages;
    prevPage.disabled = previewPageNum <= 1;
    nextPage.disabled = previewPageNum >= previewPdf.numPages;
  }

  function makeName(rec){
    var plate = (rec.reportPlate||"").trim().toUpperCase();
    var m = (rec.date||"").match(/^(\d{2})[\/.\-](\d{2})(?:[\/.\-]\d{4})?$/);

    if (!plate || !m) return "";
    return plate + " - " + m[1] + "." + m[2] + ".pdf";
  }

  function downloadOne(rec){
    if (rec.mapPlate && rec.reportPlate && rec.mapPlate !== rec.reportPlate && !rec.userConfirmed) {
      openPopup(rec);
      return;
    }

    var name = makeName(rec);

    if (!name) {
      alert("Confira a placa e a data antes de baixar.");
      return;
    }

    var url = URL.createObjectURL(rec.file);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

  async function downloadZip(){
    var unresolved = records.filter(function(r){
      return r.mapPlate && r.reportPlate && r.mapPlate !== r.reportPlate && !r.userConfirmed;
    });

    if (unresolved.length) {
      openPopup(unresolved[0]);
      return;
    }

    if (typeof JSZip === "undefined") {
      alert("A biblioteca ZIP não carregou.");
      return;
    }

    var valid = records.filter(function(r){ return !!makeName(r); });

    if (!valid.length) {
      alert("Nenhum arquivo está pronto para baixar.");
      return;
    }

    var zip = new JSZip();
    var used = {};

    for (var i=0; i<valid.length; i++) {
      var rec = valid[i];
      var name = makeName(rec);

      used[name] = (used[name] || 0) + 1;
      if (used[name] > 1) {
        name = name.replace(/\.pdf$/i, " ("+used[name]+").pdf");
      }

      zip.file(name, await rec.file.arrayBuffer());
    }

    var blob = await zip.generateAsync({type:"blob"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "carregamentos-renomeados.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

})();
