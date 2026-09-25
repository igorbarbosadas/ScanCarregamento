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
  var zoomOut = $("#zoomOut");
  var zoomIn = $("#zoomIn");
  var zoomReset = $("#zoomReset");
  var zoomInfo = $("#zoomInfo");

  var records = [];
  var rowRefreshers = {};
  var pendingRecord = null;
  var duplicateModal = $("#duplicateModal");
  var dupFile1Name = $("#dupFile1Name");
  var dupFile2Name = $("#dupFile2Name");
  var dupFile1Info = $("#dupFile1Info");
  var dupFile2Info = $("#dupFile2Info");
  var dupPlate = $("#dupPlate");
  var dupDate = $("#dupDate");
  var dupCanvas1 = $("#dupCanvas1");
  var dupCanvas2 = $("#dupCanvas2");
  var dupPrev1 = $("#dupPrev1");
  var dupNext1 = $("#dupNext1");
  var dupPrev2 = $("#dupPrev2");
  var dupNext2 = $("#dupNext2");
  var dupPageInfo1 = $("#dupPageInfo1");
  var dupPageInfo2 = $("#dupPageInfo2");
  var dupZoomOut1 = $("#dupZoomOut1");
  var dupZoomIn1 = $("#dupZoomIn1");
  var dupZoomOut2 = $("#dupZoomOut2");
  var dupZoomIn2 = $("#dupZoomIn2");
  var dupZoomInfo1 = $("#dupZoomInfo1");
  var dupZoomInfo2 = $("#dupZoomInfo2");
  var pendingDuplicate = null;
  var dupPdf1 = null;
  var dupPdf2 = null;
  var dupPage1 = 1;
  var dupPage2 = 1;
  var dupZoom1 = 1;
  var dupZoom2 = 1;
  var surfacedDuplicatePairs = {};
  var previewPdf = null;
  var previewPageNum = 1;
  var previewZoom = 1;

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
    surfacedDuplicatePairs = {};
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

    var dupBtn = e.target.closest(".compare-dup-btn");
    if (dupBtn) {
      e.preventDefault();
      var dupRow = dupBtn.closest("tr");
      if (!dupRow) return;
      var dupRec = records.find(function(r){ return r.id === dupRow.dataset.id; });
      if (!dupRec || !dupRec.duplicateOfId) return;
      var original = records.find(function(r){ return r.id === dupRec.duplicateOfId; });
      if (!original) return;
      openDuplicateModal(original, dupRec);
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
        alert("A placa do Checkin não foi identificada.");
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

    if (target.closest("#zoomOut")) {
      e.preventDefault();
      previewZoom = Math.max(0.5, previewZoom - 0.25);
      zoomInfo.textContent = Math.round(previewZoom * 100) + "%";
      renderPreviewPage();
      return;
    }

    if (target.closest("#zoomIn")) {
      e.preventDefault();
      previewZoom = Math.min(3, previewZoom + 0.25);
      zoomInfo.textContent = Math.round(previewZoom * 100) + "%";
      renderPreviewPage();
      return;
    }

    if (target.closest("#zoomReset")) {
      e.preventDefault();
      previewZoom = 1;
      zoomInfo.textContent = "100%";
      renderPreviewPage();
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


  duplicateModal.addEventListener("click", function(e){
    var target = e.target;

    if(target === duplicateModal || target.closest("#closeDuplicateX") || target.closest("#closeDuplicate")){
      closeDuplicateModal();
      return;
    }

    if(target.closest("#dupPrev1")){
      if(dupPdf1 && dupPage1 > 1){
        dupPage1--;
        renderDuplicatePage(1);
      }
      return;
    }

    if(target.closest("#dupNext1")){
      if(dupPdf1 && dupPage1 < dupPdf1.numPages){
        dupPage1++;
        renderDuplicatePage(1);
      }
      return;
    }

    if(target.closest("#dupPrev2")){
      if(dupPdf2 && dupPage2 > 1){
        dupPage2--;
        renderDuplicatePage(2);
      }
      return;
    }

    if(target.closest("#dupNext2")){
      if(dupPdf2 && dupPage2 < dupPdf2.numPages){
        dupPage2++;
        renderDuplicatePage(2);
      }
      return;
    }

    if(target.closest("#dupZoomOut1")){
      dupZoom1 = Math.max(0.5, dupZoom1 - 0.25);
      dupZoomInfo1.textContent = Math.round(dupZoom1 * 100) + "%";
      renderDuplicatePage(1);
      return;
    }

    if(target.closest("#dupZoomIn1")){
      dupZoom1 = Math.min(3, dupZoom1 + 0.25);
      dupZoomInfo1.textContent = Math.round(dupZoom1 * 100) + "%";
      renderDuplicatePage(1);
      return;
    }

    if(target.closest("#dupZoomOut2")){
      dupZoom2 = Math.max(0.5, dupZoom2 - 0.25);
      dupZoomInfo2.textContent = Math.round(dupZoom2 * 100) + "%";
      renderDuplicatePage(2);
      return;
    }

    if(target.closest("#dupZoomIn2")){
      dupZoom2 = Math.min(3, dupZoom2 + 0.25);
      dupZoomInfo2.textContent = Math.round(dupZoom2 * 100) + "%";
      renderDuplicatePage(2);
      return;
    }

    if(target.closest("#keepBothDup")){
      if(!pendingDuplicate) return;
      keepBothDuplicates(pendingDuplicate.first, pendingDuplicate.second);
      closeDuplicateModal();
      return;
    }

    if(target.closest("#ignoreFirstDup")){
      if(!pendingDuplicate) return;
      ignoreDuplicateRecord(pendingDuplicate.first);
      closeDuplicateModal();
      return;
    }

    if(target.closest("#ignoreSecondDup")){
      if(!pendingDuplicate) return;
      ignoreDuplicateRecord(pendingDuplicate.second);
      closeDuplicateModal();
      return;
    }
  });

  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && !confirmModal.classList.contains("hidden")) {
      closePopup();
    }
    if (e.key === "Escape" && !duplicateModal.classList.contains("hidden")) {
      closeDuplicateModal();
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
        var added = addRecord(Object.assign({file:file}, result));
        await recomputeDuplicates(added.id);
      } catch (err) {
        console.error(err);
        var addedError = addRecord({
          file:file,
          reportPlate:"",
          mapPlate:"",
          date:"",
          printedDateTime:"",
          confidence:"error",
          message:"Não foi possível ler",
          pageRotations:{}
        });
        await recomputeDuplicates(addedError.id);
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
    var printedDateTime = "";
    var pageRotations = {};

    for (var pageNo=1; pageNo<=pdf.numPages; pageNo++){
      onStatus("Identificando página " + pageNo + " de " + pdf.numPages + " · " + file.name);

      var page = await pdf.getPage(pageNo);
      var embedded = "";
      var pageRotation = 0;

      try {
        var content = await page.getTextContent();
        embedded = content.items.map(function(i){ return i.str; }).join(" ");
      } catch(e){}

      var embeddedNorm = normalize(embedded);

      if (!isReportPage(embeddedNorm) && !isMapPage(embeddedNorm)) {
        pageRotation = await detectPageRotation(page, onStatus, file.name, pageNo);
      }
      pageRotations[pageNo] = pageRotation;

      if (isReportPage(embeddedNorm) && !reportPlate) {
        reportPlate = extractReportPlate(embeddedNorm);

        if (!reportPlate) {
          var reportText = await ocrRegion(page, {
            x:0.03, y:0.07, w:0.60, h:0.30, scale:2.6
          }, onStatus, "placa do Checkin");

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
        if (!printedDateTime) {
          printedDateTime = extractPrintedDateTime(embeddedNorm);
        }

        if (!mapPlate) {
          var mapTopText = await ocrRegion(page, {
            x:0.54, y:0.00, w:0.44, h:0.22, scale:2.6
          }, onStatus, "placa do mapa", pageRotation);

          mapPlate = extractMapPlate(normalize(mapTopText)) ||
                     extractAnyPlate(normalize(mapTopText));
        }

        if (!printedDate) {
          var mapBottomText = await ocrRegion(page, {
            x:0.02, y:0.80, w:0.96, h:0.19, scale:2.6
          }, onStatus, "data de impressão", pageRotation);

          var mapBottomNorm = normalize(mapBottomText);
          printedDate = extractPrintedDate(mapBottomNorm) ||
                        extractAnyDate(mapBottomNorm);
          printedDateTime = extractPrintedDateTime(mapBottomNorm) || printedDateTime;
        }
      }

      if (!isReportPage(embeddedNorm) && !isMapPage(embeddedNorm)) {
        var headerText = await ocrRegion(page, {
          x:0.02, y:0.00, w:0.96, h:0.34, scale:1.9
        }, onStatus, "cabeçalho", pageRotation);

        var headerNorm = normalize(headerText);

        if (isReportPage(headerNorm) && !reportPlate) {
          reportPlate = extractReportPlate(headerNorm);

          if (!reportPlate) {
            var plateZone = await ocrRegion(page, {
              x:0.05, y:0.12, w:0.43, h:0.18, scale:3.0
            }, onStatus, "campo placa do Checkin", pageRotation);

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
              }, onStatus, "campo veículo/placa", pageRotation);

              mapPlate = extractMapPlate(normalize(mapPlateZone)) ||
                         extractAnyPlate(normalize(mapPlateZone));
            }
          }

          if (!printedDate) {
            var bottomZone = await ocrRegion(page, {
              x:0.02, y:0.80, w:0.96, h:0.19, scale:2.8
            }, onStatus, "linha impresso por", pageRotation);

            var bottomNorm = normalize(bottomZone);
            printedDate = extractPrintedDate(bottomNorm) ||
                          extractAnyDate(bottomNorm);
            printedDateTime = extractPrintedDateTime(bottomNorm) || printedDateTime;
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
      message = "Placa do Checkin não encontrada";
    } else if (!printedDate) {
      message = "Data não encontrada";
    } else if (!mapPlate) {
      message = "Mapa sem placa";
    }

    return {
      reportPlate:reportPlate,
      mapPlate:mapPlate,
      date:printedDate,
      printedDateTime:printedDateTime,
      confidence:confidence,
      message:message,
      pageRotations:pageRotations
    };
  }

  async function detectPageRotation(page, onStatus, fileName, pageNo){
    if (typeof Tesseract === "undefined") return 0;

    var candidates = [0, 180];
    var bestRotation = 0;
    var bestScore = -1;

    for (var i=0; i<candidates.length; i++){
      var rotation = candidates[i];

      try{
        if(onStatus){
          onStatus("Verificando orientação · página " + pageNo + " · " + fileName);
        }

        var full = await renderRotatedCanvas(page, 1.25, rotation);

        // Lê só o topo da página já rotacionada.
        var crop = document.createElement("canvas");
        crop.width = full.width;
        crop.height = Math.max(1, Math.floor(full.height * 0.34));

        var ctx = crop.getContext("2d",{willReadFrequently:true});
        ctx.drawImage(
          full,
          0, 0, full.width, crop.height,
          0, 0, crop.width, crop.height
        );

        var result = await Tesseract.recognize(crop, "por");
        var text = normalize((result && result.data && result.data.text) || "");
        var score = orientationScore(text);

        if(score > bestScore){
          bestScore = score;
          bestRotation = rotation;
        }
      }catch(e){
        console.warn("Falha ao verificar orientação:", e);
      }
    }

    return bestRotation;
  }

  function orientationScore(t){
    var score = 0;
    var terms = [
      "RELATORIO DE CARREGAMENTO",
      "CHECKIN",
      "MAPA DE CARREGAMENTO",
      "ARMAZEM SAO PAULO",
      "MOTORISTA",
      "PLACA",
      "VEICULO/PLACA",
      "ORDEM DE FRETE"
    ];

    for(var i=0;i<terms.length;i++){
      if(t.indexOf(terms[i]) >= 0) score += 3;
    }

    // Dá um pequeno peso a textos legíveis comuns dos formulários.
    if(t.indexOf("RESPONSAVEL") >= 0) score++;
    if(t.indexOf("DESTINO") >= 0) score++;
    if(t.indexOf("CONFERENTE") >= 0) score++;

    return score;
  }

  async function renderRotatedCanvas(page, scale, rotation){
    var viewport = page.getViewport({scale:scale});
    var source = document.createElement("canvas");
    var sourceCtx = source.getContext("2d",{willReadFrequently:true});

    source.width = Math.floor(viewport.width);
    source.height = Math.floor(viewport.height);

    await page.render({
      canvasContext:sourceCtx,
      viewport:viewport
    }).promise;

    if(rotation !== 180) return source;

    var rotated = document.createElement("canvas");
    rotated.width = source.width;
    rotated.height = source.height;

    var ctx = rotated.getContext("2d",{willReadFrequently:true});
    ctx.translate(rotated.width, rotated.height);
    ctx.rotate(Math.PI);
    ctx.drawImage(source, 0, 0);

    return rotated;
  }

  async function ocrRegion(page, region, onStatus, label, rotation){
    if (typeof Tesseract === "undefined") {
      throw new Error("Tesseract não carregou");
    }

    rotation = rotation || 0;

    var full = await renderRotatedCanvas(page, region.scale || 2.4, rotation);

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

  function extractPrintedDateTime(t){
    var pos = t.indexOf("IMPRESSO POR");
    if (pos < 0) pos = t.indexOf("IMPRESSOPOR");
    if (pos < 0) return "";

    var zone = t.slice(pos, pos + 320);

    var m = zone.match(/(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})\s*[-–—]?\s*(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) {
      // Alguns scans unem código, data e hora com hífens.
      m = zone.match(/(\d{2})[\/.\-](\d{2})[\/.\-](\d{4}).{0,20}?(\d{2}):(\d{2})(?::(\d{2}))?/);
    }
    if (!m) return "";

    return m[1]+"/"+m[2]+"/"+m[3]+" "+m[4]+":"+m[5]+":"+(m[6]||"00");
  }

  function printedDateTimeToMs(value){
    var m = (value||"").match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if(!m) return 0;

    var dt = new Date(
      Number(m[3]),
      Number(m[2])-1,
      Number(m[1]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6]),
      0
    );

    return dt.getTime() || 0;
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
      printedDateTime:data.printedDateTime||"",
      confidence:data.confidence||"warn",
      message:data.message||"Revisar",
      userConfirmed:false,
      pageRotations:data.pageRotations||{},
      duplicateState:"",
      duplicateOfId:"",
      ignored:false,
      versionSuffix:"",
      duplicateResolved:false,
      resolvedDuplicateKey:""
    };

    records.push(rec);

    var row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = rec.id;

    var plateInput = row.querySelector(".plate-input");
    var dateInput = row.querySelector(".date-input");
    var mapPlateCell = row.querySelector(".map-plate");
    var status = row.querySelector(".status");
    var newName = row.querySelector(".new-name");
    var compareDupBtn = row.querySelector(".compare-dup-btn");

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

      status.classList.remove("ok","warn","error","dup","exactdup");

      if(rec.ignored){
        status.textContent = "Ignorado";
        status.classList.add("error");
        compareDupBtn.classList.add("hidden");
      } else if(rec.duplicateState === "exact"){
        status.textContent = "Arquivo duplicado";
        status.classList.add("exactdup");
        compareDupBtn.classList.remove("hidden");
      } else if(rec.duplicateState === "possible"){
        status.textContent = "Possível duplicado";
        status.classList.add("dup");
        compareDupBtn.classList.remove("hidden");
      } else if (rec.userConfirmed) {
        status.textContent = "Confirmado";
        status.classList.add("ok");
        compareDupBtn.classList.add("hidden");
      } else if (rec.reportPlate && rec.mapPlate) {
        if (rec.reportPlate === rec.mapPlate) {
          status.textContent = "Placas conferem";
          status.classList.add("ok");
        } else {
          status.textContent = "Confirmar divergência";
          status.classList.add("warn");
        }
        compareDupBtn.classList.add("hidden");
      } else {
        status.textContent = rec.message;
        status.classList.add(rec.confidence);
        compareDupBtn.classList.add("hidden");
      }

      newName.textContent = makeName(rec) || "Preencha placa e data";
    }

    plateInput.addEventListener("input", refresh);
    dateInput.addEventListener("input", refresh);

    plateInput.addEventListener("change", async function(){
      rec.duplicateResolved = false;
      rec.resolvedDuplicateKey = "";
      rec.versionSuffix = "";
      await recomputeDuplicates(rec.id);
    });
    dateInput.addEventListener("change", async function(){
      rec.duplicateResolved = false;
      rec.resolvedDuplicateKey = "";
      rec.versionSuffix = "";
      await recomputeDuplicates(rec.id);
    });

    row.querySelector(".download-btn").addEventListener("click", function(){
      downloadOne(rec);
    });

    rowRefreshers[rec.id] = refresh;
    refresh();
    resultsBody.appendChild(row);
    return rec;
  }


  async function fileHash(file){
    try{
      var buffer = await file.arrayBuffer();
      var digest = await crypto.subtle.digest("SHA-256", buffer);
      var bytes = Array.from(new Uint8Array(digest));
      return bytes.map(function(b){ return b.toString(16).padStart(2,"0"); }).join("");
    }catch(e){
      return "";
    }
  }

  async function recomputeDuplicates(focusId){
    // Limpa somente estados de duplicidade. Mantém confirmações de placa e arquivos ignorados.
    records.forEach(function(r){
      r.duplicateState = "";
      r.duplicateOfId = "";
      if(!r.ignored && !r.duplicateResolved) r.versionSuffix = "";
    });

    var groups = {};

    records.forEach(function(r){
      if(r.ignored) return;
      var key = duplicateKey(r);
      if(!key) return;
      if(!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    var duplicatePairs = [];

    Object.keys(groups).forEach(function(key){
      var group = groups[key];
      if(group.length < 2) return;

      // Mantém o primeiro como referência e marca os demais.
      var first = group[0];

      for(var i=1; i<group.length; i++){
        var current = group[i];

        if(first.resolvedDuplicateKey &&
           current.resolvedDuplicateKey &&
           first.resolvedDuplicateKey === current.resolvedDuplicateKey){
          continue;
        }

        current.duplicateOfId = first.id;
        duplicatePairs.push([first, current]);
      }
    });

    // Classifica cada par como exato ou possível.
    for(var p=0; p<duplicatePairs.length; p++){
      var first = duplicatePairs[p][0];
      var second = duplicatePairs[p][1];

      var firstHash = first.fileHash || await fileHash(first.file);
      var secondHash = second.fileHash || await fileHash(second.file);

      first.fileHash = firstHash;
      second.fileHash = secondHash;

      if(firstHash && secondHash && firstHash === secondHash){
        second.duplicateState = "exact";
      }else{
        second.duplicateState = "possible";
      }
    }

    // Atualiza todas as linhas, inclusive a que acabou de ser confirmada/editada.
    records.forEach(function(r){
      var refresh = rowRefreshers[r.id];
      if(refresh) refresh();
    });

    // Se o arquivo em foco agora virou duplicado, abre o popup uma vez para esse par.
    if(focusId){
      var focus = records.find(function(r){ return r.id === focusId; });
      if(focus && focus.duplicateOfId && !focus.ignored){
        var original = records.find(function(r){ return r.id === focus.duplicateOfId; });
        if(original){
          var pairKey = original.id + "|" + focus.id;
          if(!surfacedDuplicatePairs[pairKey]){
            surfacedDuplicatePairs[pairKey] = true;
            openDuplicateModal(original, focus);
          }
        }
      }
    }
  }

  function duplicateKey(rec){
    var m = (rec.date||"").match(/^(\d{2})[\/.\-](\d{2})(?:[\/.\-](\d{4}))?$/);
    if(!m) return "";
    return (rec.reportPlate||"").toUpperCase() + "|" + m[1] + "|" + m[2] + "|" + (m[3]||"");
  }

  async function openDuplicateModal(first, second){
    pendingDuplicate = {first:first, second:second};

    dupFile1Name.textContent = first.file ? first.file.name : "---";
    dupFile2Name.textContent = second.file ? second.file.name : "---";

    dupFile1Info.textContent = first.printedDateTime
      ? "Impresso por: " + first.printedDateTime
      : "Horário de Impresso por não identificado";
    dupFile2Info.textContent = second.printedDateTime
      ? "Impresso por: " + second.printedDateTime
      : "Horário de Impresso por não identificado";

    dupPlate.textContent = first.reportPlate || second.reportPlate || "---";
    dupDate.textContent = first.date || second.date || "---";

    duplicateModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    dupPdf1 = null;
    dupPdf2 = null;
    dupPage1 = 1;
    dupPage2 = 1;
    dupZoom1 = 1;
    dupZoom2 = 1;
    dupZoomInfo1.textContent = "100%";
    dupZoomInfo2.textContent = "100%";

    dupPageInfo1.textContent = "Carregando...";
    dupPageInfo2.textContent = "Carregando...";
    dupPrev1.disabled = dupNext1.disabled = true;
    dupPrev2.disabled = dupNext2.disabled = true;

    try{
      var buffers = await Promise.all([
        first.file.arrayBuffer(),
        second.file.arrayBuffer()
      ]);

      var docs = await Promise.all([
        pdfjsLib.getDocument({data:buffers[0]}).promise,
        pdfjsLib.getDocument({data:buffers[1]}).promise
      ]);

      dupPdf1 = docs[0];
      dupPdf2 = docs[1];

      await Promise.all([
        renderDuplicatePage(1),
        renderDuplicatePage(2)
      ]);
    }catch(e){
      console.error("Erro ao abrir PDFs duplicados:", e);
      dupPageInfo1.textContent = "Falha ao abrir";
      dupPageInfo2.textContent = "Falha ao abrir";
    }
  }

  async function renderDuplicatePage(which){
    var pdf = which === 1 ? dupPdf1 : dupPdf2;
    var pageNum = which === 1 ? dupPage1 : dupPage2;
    var canvas = which === 1 ? dupCanvas1 : dupCanvas2;
    var info = which === 1 ? dupPageInfo1 : dupPageInfo2;
    var prev = which === 1 ? dupPrev1 : dupPrev2;
    var next = which === 1 ? dupNext1 : dupNext2;

    if(!pdf) return;

    var page = await pdf.getPage(pageNum);
    var rec = which === 1 ? pendingDuplicate.first : pendingDuplicate.second;
    var rotation = 0;

    if(rec && rec.pageRotations){
      rotation = rec.pageRotations[pageNum] || 0;
    }

    var baseViewport = page.getViewport({scale:1});
    var maxWidth = 620;
    var baseScale = Math.max(0.55, Math.min(maxWidth / baseViewport.width, 1.35));
    var zoom = which === 1 ? dupZoom1 : dupZoom2;
    var scale = Math.max(0.3, Math.min(baseScale * zoom, 3.5));

    var rendered = await renderRotatedCanvas(page, scale, rotation);

    canvas.width = rendered.width;
    canvas.height = rendered.height;

    var ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(rendered,0,0);

    info.textContent = "Página " + pageNum + " de " + pdf.numPages;
    prev.disabled = pageNum <= 1;
    next.disabled = pageNum >= pdf.numPages;
  }

  function closeDuplicateModal(){
    duplicateModal.classList.add("hidden");
    document.body.style.overflow = "";
    pendingDuplicate = null;
    dupPdf1 = null;
    dupPdf2 = null;
    dupPage1 = 1;
    dupPage2 = 1;
    dupZoom1 = 1;
    dupZoom2 = 1;
  }


  function keepBothDuplicates(first, second){
    first.ignored = false;
    second.ignored = false;

    first.duplicateState = "";
    second.duplicateState = "";

    // Todos os arquivos com a mesma placa + data passam a pertencer
    // ao mesmo grupo de versões.
    var groupKey = duplicateKey(first) || duplicateKey(second);

    if(groupKey){
      records.forEach(function(r){
        if(!r.ignored && duplicateKey(r) === groupKey){
          r.duplicateResolved = true;
          r.resolvedDuplicateKey = groupKey;
          r.duplicateState = "";
          r.duplicateOfId = "";
        }
      });

      assignVersionSuffixesForGroup(groupKey);
    }

    surfacedDuplicatePairs[first.id + "|" + second.id] = true;

    records.forEach(function(r){
      if(groupKey && duplicateKey(r) === groupKey){
        var refresh = rowRefreshers[r.id];
        if(refresh) refresh();
      }
    });
  }

  function assignVersionSuffixesForGroup(groupKey){
    var group = records.filter(function(r){
      return !r.ignored && duplicateKey(r) === groupKey;
    });

    if(!group.length) return;

    // Ordena do mais antigo para o mais atual pela data/hora de "Impresso por".
    // Se faltar horário, mantém ordem de entrada como fallback estável.
    group.sort(function(a,b){
      var ta = printedDateTimeToMs(a.printedDateTime);
      var tb = printedDateTimeToMs(b.printedDateTime);

      if(ta && tb && ta !== tb) return ta - tb;
      if(ta && !tb) return -1;
      if(!ta && tb) return 1;

      return records.indexOf(a) - records.indexOf(b);
    });

    group.forEach(function(r, index){
      if(index === 0){
        r.versionSuffix = "";
      }else{
        r.versionSuffix = "ver" + (index + 1);
      }
    });
  }

  function ignoreDuplicateRecord(rec){
    var groupKey = duplicateKey(rec);

    rec.ignored = true;
    rec.duplicateState = "";
    rec.versionSuffix = "";
    rec.duplicateResolved = false;
    rec.resolvedDuplicateKey = "";

    var refresh = rowRefreshers[rec.id];
    if(refresh) refresh();

    if(groupKey){
      assignVersionSuffixesForGroup(groupKey);

      records.forEach(function(r){
        if(!r.ignored && duplicateKey(r) === groupKey){
          var rowRefresh = rowRefreshers[r.id];
          if(rowRefresh) rowRefresh();
        }
      });
    }

    recomputeDuplicates();
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
    previewZoom = 1;
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
    pendingRecord.duplicateResolved = false;
    pendingRecord.resolvedDuplicateKey = "";
    pendingRecord.versionSuffix = "";

    var confirmedId = pendingRecord.id;
    var refresh = rowRefreshers[confirmedId];
    if (refresh) refresh(plate);

    closePopup();

    // A placa pode ter sido corrigida manualmente. Recalcula duplicidades agora.
    recomputeDuplicates(confirmedId);
  }

  async function renderPreviewPage(){
    if (!previewPdf) return;

    var page = await previewPdf.getPage(previewPageNum);
    var rotation = 0;

    if(pendingRecord && pendingRecord.pageRotations){
      rotation = pendingRecord.pageRotations[previewPageNum] || 0;
    }

    var baseViewport = page.getViewport({scale:1});
    var available = Math.min(1050, Math.max(320, (pdfCanvasWrap.clientWidth || 900)-36));
    var fitScale = Math.max(0.7, Math.min(available/baseViewport.width, 2.0));
    var scale = Math.max(0.35, Math.min(fitScale * previewZoom, 4.0));

    var rendered = await renderRotatedCanvas(page, scale, rotation);

    pdfCanvas.width = rendered.width;
    pdfCanvas.height = rendered.height;

    var ctx = pdfCanvas.getContext("2d");
    ctx.clearRect(0,0,pdfCanvas.width,pdfCanvas.height);
    ctx.drawImage(rendered,0,0);

    pageInfo.textContent = "Página " + previewPageNum + " de " + previewPdf.numPages;
    prevPage.disabled = previewPageNum <= 1;
    nextPage.disabled = previewPageNum >= previewPdf.numPages;
  }

  function makeName(rec){
    var plate = (rec.reportPlate||"").trim().toUpperCase();
    var m = (rec.date||"").match(/^(\d{2})[\/.\-](\d{2})(?:[\/.\-]\d{4})?$/);

    if (rec.ignored || !plate || !m) return "";
    var suffix = rec.versionSuffix ? " " + rec.versionSuffix : "";
    return plate + " - " + m[1] + "." + m[2] + suffix + ".pdf";
  }

  function downloadOne(rec){
    if(rec.ignored){
      alert("Este arquivo foi marcado como ignorado.");
      return;
    }

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
