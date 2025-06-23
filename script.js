import * as pdfjsLib from 'https://unpkg.com/pdfjs-dist@4.2.67/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.2.67/build/pdf.worker.mjs';

console.log('Configuration PDF.js via CDN. C\'est le test final.');

document.addEventListener("DOMContentLoaded", () => {
  // Vérifier si PDFLib est chargé (depuis pdf-lib.min.js)
  if (typeof PDFLib === "undefined") {
    console.error(
      "PDFLib (pdf-lib.min.js) n'est pas chargé ou n'expose pas la variable globale PDFLib."
    );
    alert(
      "Erreur critique : la bibliothèque de modification PDF n'a pu être chargée. Vérifiez la console et l'inclusion du fichier."
    );
    return; // Empêcher le reste du script de s'exécuter si pdf-lib est manquant
  }
  const { PDFDocument, rgb, StandardFonts, degrees } = PDFLib;

  // --- Éléments UI ---
  const fileUploadScreen = document.getElementById("fileUploadScreen");
  // const uploadBox = document.querySelector('.upload-box'); // Si besoin pour animations
  const dropZone = document.getElementById("dropZone");
  const selectFileBtn = document.getElementById("selectFileBtn");
  const fileInput = document.getElementById("fileInput");
  const pdfEditorScreen = document.getElementById("pdfEditorScreen");
  const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
  const leftSidebar = document.getElementById("leftSidebar");
  const backToUploadBtn = document.getElementById("backToUploadBtn");
  const saveModifiedPdfBtn = document.getElementById("saveModifiedPdfBtn"); // Sera vérifié plus tard
  const pdfDocumentName = document.getElementById("pdfDocumentName");
  const metaAlias = document.getElementById("metaAlias");
  const metaPages = document.getElementById("metaPages");
  const metaOriginalName = document.getElementById("metaOriginalName");
  const metaUploadedDate = document.getElementById("metaUploadedDate");
  const pdfCanvas = document.getElementById("pdfCanvas");
  const ctx = pdfCanvas.getContext("2d");
  const pdfLoadingSpinner = document.getElementById("pdfLoadingSpinner");
  const thumbnailSidebar = document.getElementById("thumbnailSidebar");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const currentPageNumSpan = document.getElementById("currentPageNum");
  const totalPagesNumSpan = document.getElementById("totalPagesNum");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const zoomLevelDisplay = document.getElementById("zoomLevelDisplay");
  const downloadOriginalBtn = document.getElementById("downloadOriginalBtn");

  // --- Variables d'état ---
  let pdfDoc_js = null; // Pour PDF.js (affichage)
  let pdfDoc_lib = null; // Pour pdf-lib (modification)
  let currentPageNum = 1;
  let currentZoomLevel = 1.0;
  let originalFile = null;
  let pageRotations = {}; // Stocker les rotations { pageNum: angle }
  let draggedItem = null;
  let draggedItemSourceIndex = -1; // UI-based index (1-N)
  let thumbnailPadding = 0; // Sera initialisé

  // --- Initialisation du Padding des Miniatures ---
  function initializeThumbnailPadding() {
    const tempThumbnailItemForPadding = document.createElement("div");
    tempThumbnailItemForPadding.classList.add("thumbnail-item");
    tempThumbnailItemForPadding.style.visibility = "hidden";
    document.body.appendChild(tempThumbnailItemForPadding);
    const computedStyle = getComputedStyle(tempThumbnailItemForPadding);
    thumbnailPadding = parseFloat(computedStyle.paddingTop) || 0;
    document.body.removeChild(tempThumbnailItemForPadding);
  }
  initializeThumbnailPadding();

  // --- Fonctions Utilitaires ---
  function getPageLibIndex(uiPageNum) {
    return uiPageNum - 1;
  }
  function getUiPageIndex(libPageNum) {
    return libPageNum + 1;
  }

  // --- Gestion UI (transitions d'écran) ---
  function showScreen(screenElement) {
    if (screenElement === fileUploadScreen) {
      pdfEditorScreen.classList.remove("visible");
      pdfEditorScreen.style.display = "none"; // Assurer qu'il est caché
      fileUploadScreen.classList.remove("hidden");
      fileUploadScreen.style.display = "flex"; // Assurer qu'il est visible
    } else if (screenElement === pdfEditorScreen) {
      fileUploadScreen.classList.add("hidden");
      fileUploadScreen.style.display = "none";
      pdfEditorScreen.classList.add("visible");
      pdfEditorScreen.style.display = "flex";
    }
  }

  // --- Gestion de la sélection de fichier et chargement ---
  selectFileBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  function handleFile(file) {
    if (file.type !== "application/pdf") {
      alert("Veuillez sélectionner un fichier PDF.");
      return;
    }
    originalFile = file;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const typedarray = new Uint8Array(e.target.result);
      pdfLoadingSpinner.style.display = "flex";
      showScreen(pdfEditorScreen);
      try {
        pdfDoc_lib = await PDFDocument.load(typedarray);
      } catch (err) {
        console.error("Erreur chargement pdf-lib:", err);
        alert("Erreur lors du chargement du PDF pour modification.");
        backToUploadBtn.click();
        return;
      }
      await loadPdfForDisplay(typedarray, file.name);
    };
    reader.readAsArrayBuffer(file);
  }

  backToUploadBtn.addEventListener("click", () => {
    showScreen(fileUploadScreen);
    pdfDoc_js = null;
    pdfDoc_lib = null;
    currentPageNum = 1;
    currentZoomLevel = 1.0;
    originalFile = null;
    pageRotations = {};
    thumbnailSidebar.innerHTML = "";
    if (ctx) ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
    fileInput.value = "";
    pdfDocumentName.textContent = "Document name";
    metaAlias.textContent = "Document name";
    metaPages.textContent = "0";
    metaOriginalName.textContent = "...";
    metaUploadedDate.textContent = "...";
    currentPageNumSpan.textContent = "0";
    totalPagesNumSpan.textContent = "0";
    updateZoomDisplay();
  });

  async function loadPdfForDisplay(pdfData, fileName) {
    try {
       pdfDoc_js = await pdfjsLib.getDocument({ data: pdfData }).promise;

      totalPagesNumSpan.textContent = pdfDoc_js.numPages;
      currentPageNum = 1;
      pageRotations = {};
      pdfDocumentName.textContent = fileName;
      metaAlias.textContent = fileName;
      metaPages.textContent = pdfDoc_js.numPages;
      metaOriginalName.textContent = fileName;
      metaUploadedDate.textContent = new Date().toLocaleDateString();
      createThumbnailPlaceholders(pdfDoc_js.numPages);
      highlightActiveThumbnail(currentPageNum);
      await renderPage(currentPageNum);
      renderAllThumbnailsInBackground();
      updatePageIndicator();
      updateZoomDisplay();
    } catch (error) {
      console.error("Erreur loadPdfForDisplay:", error);
      alert(
        `Impossible de charger PDF pour affichage: ${error.message || error}`
      );
      backToUploadBtn.click();
    } finally {
      pdfLoadingSpinner.style.display = "none";
    }
  }

  async function refreshPdfDisplayAfterModification() {
    if (!pdfDoc_lib) return;
    pdfLoadingSpinner.style.display = "flex";
    try {
      const modifiedPdfBytes = await pdfDoc_lib.save();
      pdfDoc_js = await pdfjsLib.getDocument({ data: modifiedPdfBytes })
        .promise;
      if (currentPageNum > pdfDoc_js.numPages && pdfDoc_js.numPages > 0) {
        currentPageNum = pdfDoc_js.numPages;
      } else if (pdfDoc_js.numPages === 0) {
        currentPageNum = 1;
      } // Devrait afficher un état vide
      totalPagesNumSpan.textContent = pdfDoc_js.numPages;
      metaPages.textContent = pdfDoc_js.numPages;
      createThumbnailPlaceholders(pdfDoc_js.numPages);
      highlightActiveThumbnail(currentPageNum);
      if (pdfDoc_js.numPages > 0) {
        await renderPage(currentPageNum);
        renderAllThumbnailsInBackground();
      } else {
        if (ctx)
          ctx.clearRect(
            0,
            0,
            pdfCanvas.width,
            pdfCanvas.height
          ); /* Afficher "Aucune page" */
      }
      updatePageIndicator();
    } catch (error) {
      console.error("Erreur refreshPdfDisplay:", error);
      alert("Erreur MàJ affichage après modification.");
    } finally {
      pdfLoadingSpinner.style.display = "none";
    }
  }

  // --- Placeholders et Rendu des Miniatures ---
  function createThumbnailPlaceholders(numPages) {
    thumbnailSidebar.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const firstDropIndicator = document.createElement("div");
    firstDropIndicator.classList.add("drop-indicator");
    firstDropIndicator.id = `drop-indicator-1`;
    fragment.appendChild(firstDropIndicator);
    for (let i = 1; i <= numPages; i++) {
      const thumbnailItem = document.createElement("div");
      thumbnailItem.classList.add("thumbnail-item");
      thumbnailItem.dataset.pageNum = i;
      thumbnailItem.id = `thumb-item-${i}`;
      thumbnailItem.setAttribute("draggable", "true");
      const spinner = document.createElement("div");
      spinner.classList.add("mini-spinner");
      thumbnailItem.appendChild(spinner);
      const actionsOverlay = document.createElement("div");
      actionsOverlay.classList.add("actions-overlay");
      const rotateClockwiseBtn = document.createElement("button");
      rotateClockwiseBtn.title = "Pivoter (sens horaire)";
      rotateClockwiseBtn.innerHTML = '<i class="fas fa-redo"></i>';
      rotateClockwiseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleRotatePage(i, 90);
      });
      const deleteBtn = document.createElement("button");
      deleteBtn.title = "Supprimer la page";
      deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleDeletePage(i);
      });
      actionsOverlay.appendChild(rotateClockwiseBtn);
      actionsOverlay.appendChild(deleteBtn);
      thumbnailItem.appendChild(actionsOverlay);
      thumbnailItem.addEventListener("click", () => {
        if (currentPageNum !== i) renderPage(i, currentZoomLevel);
      });
      thumbnailItem.addEventListener("dragstart", handleDragStart);
      thumbnailItem.addEventListener("dragend", handleDragEnd);
      thumbnailItem.addEventListener("dragover", handleDragOver);
      fragment.appendChild(thumbnailItem);
      const dropIndicator = document.createElement("div");
      dropIndicator.classList.add("drop-indicator");
      dropIndicator.id = `drop-indicator-${i + 1}`;
      fragment.appendChild(dropIndicator);
    }
    thumbnailSidebar.appendChild(fragment);
    thumbnailSidebar.removeEventListener(
      "dragenter",
      handleDragEnterSidebarOrIndicator
    );
    thumbnailSidebar.removeEventListener(
      "dragleave",
      handleDragLeaveSidebarOrIndicator
    );
    thumbnailSidebar.removeEventListener("dragover", handleDragOver);
    thumbnailSidebar.removeEventListener("drop", handleDropOnSidebar);
    thumbnailSidebar.addEventListener(
      "dragenter",
      handleDragEnterSidebarOrIndicator
    );
    thumbnailSidebar.addEventListener(
      "dragleave",
      handleDragLeaveSidebarOrIndicator
    );
    thumbnailSidebar.addEventListener("dragover", handleDragOver);
    thumbnailSidebar.addEventListener("drop", handleDropOnSidebar);
  }
  async function renderAllThumbnailsInBackground() {
    if (!pdfDoc_js) return;
    for (let i = 1; i <= pdfDoc_js.numPages; i++) {
      await new Promise((resolve) =>
        requestAnimationFrame(async () => {
          await renderSingleThumbnail(i);
          resolve();
        })
      );
    }
  }
  async function renderSingleThumbnail(pageNum) {
    if (!pdfDoc_js) return;
    const thumbnailItem = document.getElementById(`thumb-item-${pageNum}`);
    if (!thumbnailItem) return;
    const existingSpinner = thumbnailItem.querySelector(".mini-spinner");
    try {
      const page = await pdfDoc_js.getPage(pageNum);
      const thumbCanvas = document.createElement("canvas");
      const containerWidth = thumbnailItem.clientWidth - 2 * thumbnailPadding;
      const containerHeight = thumbnailItem.clientHeight - 2 * thumbnailPadding;
      const rotation = pageRotations[pageNum] || 0;
      const viewportUnscaled = page.getViewport({
        scale: 1,
        rotation: rotation,
      });
      const scaleWidth = containerWidth / viewportUnscaled.width;
      const scaleHeight = containerHeight / viewportUnscaled.height;
      const scale = Math.min(scaleWidth, scaleHeight, 1); // Limiter à l'échelle 1 pour ne pas upscaler
      const viewport = page.getViewport({ scale: scale, rotation: rotation });
      thumbCanvas.height = viewport.height;
      thumbCanvas.width = viewport.width;
      const thumbCtx = thumbCanvas.getContext("2d");
      const renderContext = { canvasContext: thumbCtx, viewport: viewport };
      await page.render(renderContext).promise;
      if (existingSpinner) existingSpinner.remove();
      const existingCanvas = thumbnailItem.querySelector("canvas");
      if (existingCanvas) existingCanvas.remove();
      thumbnailItem.appendChild(thumbCanvas);
    } catch (error) {
      console.error(`Erreur rendu miniature ${pageNum}:`, error);
      if (existingSpinner) existingSpinner.remove();
      const errorText = document.createElement("span");
      errorText.classList.add("error-text");
      errorText.textContent = "Erreur";
      thumbnailItem.appendChild(errorText);
    }
  }
  async function renderPage(num, zoom = currentZoomLevel) {
    if (!pdfDoc_js || num < 1 || num > pdfDoc_js.numPages) {
      if (ctx) ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height); // Nettoyer si page invalide
      updatePageIndicator(); // Mettre à jour l'indicateur même si pas de page
      return;
    }
    currentPageNum = num;
    pdfLoadingSpinner.style.display = "flex";
    try {
      const page = await pdfDoc_js.getPage(num);
      const rotation = pageRotations[num] || 0;
      const viewport = page.getViewport({ scale: zoom, rotation: rotation });
      pdfCanvas.height = viewport.height;
      pdfCanvas.width = viewport.width;
      const renderContext = { canvasContext: ctx, viewport: viewport };
      await page.render(renderContext).promise;
      updatePageIndicator();
      highlightActiveThumbnail(num);
    } catch (error) {
      console.error(`Erreur rendu page ${num}:`, error);
      if (ctx) ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
    } finally {
      pdfLoadingSpinner.style.display = "none";
    }
  }
  function highlightActiveThumbnail(num) {
    document.querySelectorAll(".thumbnail-item").forEach((thumb) => {
      thumb.classList.remove("active");
      if (parseInt(thumb.dataset.pageNum) === num) {
        thumb.classList.add("active");
        thumb.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
      }
    });
  }
  function updatePageIndicator() {
    if (
      pdfDoc_js &&
      pdfDoc_js.numPages > 0 &&
      currentPageNum <= pdfDoc_js.numPages
    ) {
      currentPageNumSpan.textContent = currentPageNum;
      totalPagesNumSpan.textContent = pdfDoc_js.numPages;
    } else if (pdfDoc_js && pdfDoc_js.numPages === 0) {
      currentPageNumSpan.textContent = "0";
      totalPagesNumSpan.textContent = "0";
    } else {
      // Pas de doc ou page invalide
      currentPageNumSpan.textContent = "0"; // Ou currentPageNum
      totalPagesNumSpan.textContent = pdfDoc_js ? pdfDoc_js.numPages : "0";
    }
  }
  function updateZoomDisplay() {
    zoomLevelDisplay.childNodes[0].nodeValue = `${Math.round(
      currentZoomLevel * 100
    )}% `;
  }

  // --- Actions de Modification ---
  async function handleDeletePage(pageNumToDelete) {
    if (
      !pdfDoc_lib ||
      !confirm(`Voulez-vous vraiment supprimer la page ${pageNumToDelete} ?`)
    )
      return;
    const libIndex = getPageLibIndex(pageNumToDelete);
    if (libIndex < 0 || libIndex >= pdfDoc_lib.getPageCount()) {
      console.error("Index de page invalide pour suppression");
      return;
    }
    pdfDoc_lib.removePage(libIndex);
    const newPageRotations = {};
    let currentOldPage = 1;
    for (let i = 1; i <= pdfDoc_lib.getPageCount(); i++) {
      if (currentOldPage === pageNumToDelete) currentOldPage++;
      if (pageRotations[currentOldPage] !== undefined)
        newPageRotations[i] = pageRotations[currentOldPage];
      currentOldPage++;
    }
    pageRotations = newPageRotations;
    if (
      currentPageNum > pdfDoc_lib.getPageCount() &&
      pdfDoc_lib.getPageCount() > 0
    ) {
      currentPageNum = pdfDoc_lib.getPageCount();
    } else if (pdfDoc_lib.getPageCount() === 0) {
      currentPageNum = 1;
    } // Pour éviter une page invalide
    await refreshPdfDisplayAfterModification();
  }
  async function handleRotatePage(pageNumToRotate, angleIncrement) {
    if (!pdfDoc_js) return;
    pageRotations[pageNumToRotate] =
      (pageRotations[pageNumToRotate] || 0) + angleIncrement;
    pageRotations[pageNumToRotate] %= 360;
    if (pageRotations[pageNumToRotate] < 0)
      pageRotations[pageNumToRotate] += 360;
    const thumbnailItem = document.getElementById(
      `thumb-item-${pageNumToRotate}`
    );
    const existingCanvas = thumbnailItem
      ? thumbnailItem.querySelector("canvas")
      : null;
    const existingSpinner = thumbnailItem
      ? thumbnailItem.querySelector(".mini-spinner")
      : null;
    if (existingCanvas) existingCanvas.remove();
    if (thumbnailItem && !existingSpinner) {
      const spinner = document.createElement("div");
      spinner.classList.add("mini-spinner");
      thumbnailItem.insertBefore(spinner, thumbnailItem.firstChild);
    }
    await renderSingleThumbnail(pageNumToRotate);
    if (currentPageNum === pageNumToRotate)
      await renderPage(pageNumToRotate, currentZoomLevel);
  }

  // --- Logique Drag & Drop ---
  function handleDragStart(e) {
    draggedItem = e.target.closest(".thumbnail-item");
    if (!draggedItem) {
      e.preventDefault();
      return;
    }
    draggedItemSourceIndex = parseInt(draggedItem.dataset.pageNum);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedItem.id);
    setTimeout(() => {
      if (draggedItem) draggedItem.classList.add("dragging");
    }, 0);
  }
  function handleDragEnd(e) {
    if (draggedItem) draggedItem.classList.remove("dragging");
    draggedItem = null;
    draggedItemSourceIndex = -1;
    document
      .querySelectorAll(".drop-indicator.visible")
      .forEach((di) => di.classList.remove("visible"));
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function handleDragEnterSidebarOrIndicator(e) {
    e.preventDefault();
    if (!draggedItem) return;
    let targetElement = e.target;
    let indicatorToShow = null;
    document
      .querySelectorAll(".drop-indicator.visible")
      .forEach((di) => di.classList.remove("visible"));
    if (targetElement.classList.contains("drop-indicator")) {
      indicatorToShow = targetElement;
    } else if (targetElement.closest(".thumbnail-item")) {
      targetElement = targetElement.closest(".thumbnail-item");
      const rect = targetElement.getBoundingClientRect();
      const isAfter = e.clientY > rect.top + rect.height / 2;
      const pageNum = parseInt(targetElement.dataset.pageNum);
      indicatorToShow = document.getElementById(
        isAfter ? `drop-indicator-${pageNum + 1}` : `drop-indicator-${pageNum}`
      );
    } else if (targetElement === thumbnailSidebar) {
      const sidebarRect = thumbnailSidebar.getBoundingClientRect();
      const yInSidebar = e.clientY - sidebarRect.top;
      let closestIndicator = null;
      let smallestDistance = Infinity;
      thumbnailSidebar.querySelectorAll(".drop-indicator").forEach((ind) => {
        const indRect = ind.getBoundingClientRect();
        const indCenterY = indRect.top + indRect.height / 2 - sidebarRect.top;
        const distance = Math.abs(yInSidebar - indCenterY);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          closestIndicator = ind;
        }
      });
      indicatorToShow = closestIndicator;
    }
    if (indicatorToShow) {
      const indicatorPageNum = parseInt(indicatorToShow.id.split("-")[2]);
      const isIndicatorBeforeDragged =
        indicatorPageNum === draggedItemSourceIndex;
      const isIndicatorAfterDragged =
        indicatorPageNum === draggedItemSourceIndex + 1;
      if (!(isIndicatorBeforeDragged || isIndicatorAfterDragged))
        indicatorToShow.classList.add("visible");
    }
  }
  function handleDragLeaveSidebarOrIndicator(e) {
    if (!e.relatedTarget || !thumbnailSidebar.contains(e.relatedTarget)) {
      document
        .querySelectorAll(".drop-indicator.visible")
        .forEach((di) => di.classList.remove("visible"));
    }
  }
  async function handleDropOnSidebar(e) {
    e.preventDefault();
    e.stopPropagation();
    const visibleIndicator = thumbnailSidebar.querySelector(
      ".drop-indicator.visible"
    );
    document
      .querySelectorAll(".drop-indicator.visible")
      .forEach((di) => di.classList.remove("visible"));
    if (!draggedItem || !pdfDoc_lib || !visibleIndicator) {
      if (draggedItem) draggedItem.classList.remove("dragging");
      draggedItem = null;
      draggedItemSourceIndex = -1;
      return;
    }
    const targetInsertBeforeUiPageNum = parseInt(
      visibleIndicator.id.split("-")[2]
    );
    let sourceLibIndex = getPageLibIndex(draggedItemSourceIndex);
    let targetLibIndex =
      targetInsertBeforeUiPageNum > pdfDoc_lib.getPageCount()
        ? pdfDoc_lib.getPageCount()
        : getPageLibIndex(targetInsertBeforeUiPageNum);
    if (
      draggedItemSourceIndex === targetInsertBeforeUiPageNum ||
      (draggedItemSourceIndex + 1 === targetInsertBeforeUiPageNum &&
        sourceLibIndex === targetLibIndex - 1)
    ) {
      // Correction condition
      if (draggedItem) draggedItem.classList.remove("dragging");
      draggedItem = null;
      draggedItemSourceIndex = -1;
      return;
    }
    const [pageToMove] = await pdfDoc_lib.copyPages(pdfDoc_lib, [
      sourceLibIndex,
    ]);
    const draggedPageOriginalRotation = pageRotations[draggedItemSourceIndex];
    const tempRotations = {};
    for (let i = 1; i <= pdfDoc_lib.getPageCount(); i++) {
      if (i < draggedItemSourceIndex) tempRotations[i] = pageRotations[i];
      else if (i > draggedItemSourceIndex)
        tempRotations[i - 1] = pageRotations[i];
    }
    pdfDoc_lib.removePage(sourceLibIndex);
    let actualTargetLibIndex = targetLibIndex;
    if (sourceLibIndex < targetLibIndex) actualTargetLibIndex--;
    pdfDoc_lib.insertPage(actualTargetLibIndex, pageToMove);
    pageRotations = {};
    let currentOldRotIdx = 1;
    for (let i = 0; i < pdfDoc_lib.getPageCount(); i++) {
      const newUiPageNum = getUiPageIndex(i);
      if (i === actualTargetLibIndex) {
        if (draggedPageOriginalRotation !== undefined)
          pageRotations[newUiPageNum] = draggedPageOriginalRotation;
      } else {
        if (tempRotations[currentOldRotIdx] !== undefined)
          pageRotations[newUiPageNum] = tempRotations[currentOldRotIdx];
        currentOldRotIdx++;
      }
    }
    if (draggedItem) draggedItem.classList.remove("dragging");
    draggedItem = null;
    draggedItemSourceIndex = -1;
    await refreshPdfDisplayAfterModification();
  }

  // --- Enregistrement ---
  if (saveModifiedPdfBtn) {
    saveModifiedPdfBtn.addEventListener("click", async () => {
      if (!pdfDoc_lib) {
        alert("Aucun PDF chargé pour enregistrer.");
        return;
      }
      try {
        pdfLoadingSpinner.style.display = "flex";
        const libPages = pdfDoc_lib.getPages();
        libPages.forEach((page, index) => {
          const uiPageNum = getUiPageIndex(index);
          if (pageRotations[uiPageNum] !== undefined)
            page.setRotation(degrees(pageRotations[uiPageNum]));
        });
        const pdfBytes = await pdfDoc_lib.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const originalName = originalFile ? originalFile.name : "document.pdf";
        const newName = originalName.replace(/(\.pdf)$/i, "_modifié$1");
        link.download = newName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } catch (error) {
        console.error("Erreur lors de l'enregistrement du PDF:", error);
        alert("Erreur lors de l'enregistrement des modifications.");
      } finally {
        pdfLoadingSpinner.style.display = "none";
      }
    });
  } else {
    console.error(
      "ERREUR CRITIQUE: Le bouton 'saveModifiedPdfBtn' n'a pas été trouvé dans le DOM. Vérifiez l'ID dans index.html."
    );
  }

  // --- Autres Écouteurs ---
  prevPageBtn.addEventListener("click", () => {
    if (!pdfDoc_js || currentPageNum <= 1) return;
    renderPage(currentPageNum - 1, currentZoomLevel);
  });
  nextPageBtn.addEventListener("click", () => {
    if (!pdfDoc_js || currentPageNum >= pdfDoc_js.numPages) return;
    renderPage(currentPageNum + 1, currentZoomLevel);
  });
  zoomInBtn.addEventListener("click", () => {
    if (!pdfDoc_js) return;
    currentZoomLevel = parseFloat((currentZoomLevel + 0.1).toFixed(1));
    renderPage(currentPageNum, currentZoomLevel);
    updateZoomDisplay();
  });
  zoomOutBtn.addEventListener("click", () => {
    if (!pdfDoc_js || currentZoomLevel <= 0.2) return;
    currentZoomLevel = parseFloat((currentZoomLevel - 0.1).toFixed(1));
    renderPage(currentPageNum, currentZoomLevel);
    updateZoomDisplay();
  });
  if (downloadOriginalBtn) {
    downloadOriginalBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (originalFile) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(originalFile);
        link.download = originalFile.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } else {
        alert("Aucun fichier original à télécharger.");
      }
    });
  }
  if (toggleSidebarBtn && leftSidebar) {
    toggleSidebarBtn.addEventListener("click", () => {
      leftSidebar.classList.toggle("collapsed");
    });
  }
  const toastCloseButton = document.querySelector(".toast-close");
  const toastNotification = document.querySelector(".toast-notification");
  if (toastCloseButton && toastNotification) {
    toastCloseButton.addEventListener("click", () => {
      toastNotification.style.display = "none";
    });
  }

  showScreen(fileUploadScreen); // Initialiser l'état de l'UI
});
