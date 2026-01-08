import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import open from "open";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3456;

const OUTPUT_DIR = path.join(__dirname, "../output");

app.use(express.json());
app.use("/output", express.static(OUTPUT_DIR));

// Get all images for a phase
app.get("/api/images/:phase", async (req, res) => {
  const phase = req.params.phase;
  const phaseDir = path.join(OUTPUT_DIR, phase);

  try {
    const folders = await fs.readdir(phaseDir);
    const result = {};

    for (const folder of folders) {
      const folderPath = path.join(phaseDir, folder);
      const stat = await fs.stat(folderPath);

      if (stat.isDirectory()) {
        const files = await fs.readdir(folderPath);
        result[folder] = files
          .filter((f) => f.endsWith(".png"))
          .sort()
          .map((f) => `/output/${phase}/${folder}/${f}`);
      }
    }

    res.json(result);
  } catch (error) {
    res.json({});
  }
});

// Get selected images
app.get("/api/selected/:phase", async (req, res) => {
  const phase = req.params.phase;
  const selectedFile = path.join(OUTPUT_DIR, `${phase}-selected.json`);

  try {
    const data = await fs.readFile(selectedFile, "utf-8");
    res.json(JSON.parse(data));
  } catch {
    res.json({});
  }
});

// Save anchor selection
app.post("/api/select/:phase", async (req, res) => {
  const phase = req.params.phase;
  const { folder, image } = req.body;
  const selectedFile = path.join(OUTPUT_DIR, `${phase}-selected.json`);

  let selections = {};
  try {
    const data = await fs.readFile(selectedFile, "utf-8");
    selections = JSON.parse(data);
  } catch {}

  selections[folder] = image;
  await fs.writeFile(selectedFile, JSON.stringify(selections, null, 2));

  // For anchors, copy file to anchors-selected folder
  if (phase === "anchors") {
    const selectedDir = path.join(OUTPUT_DIR, "anchors-selected");
    await fs.mkdir(selectedDir, { recursive: true });

    const srcPath = path.join(OUTPUT_DIR, image.replace("/output/", ""));
    const destPath = path.join(selectedDir, `${folder}.png`);
    await fs.copyFile(srcPath, destPath);
  }

  res.json({ success: true });
});

// Toggle training selection
app.post("/api/training/toggle", async (req, res) => {
  const { image } = req.body;
  const trainingFile = path.join(OUTPUT_DIR, "training-selected.json");

  let selected = [];
  try {
    const data = await fs.readFile(trainingFile, "utf-8");
    selected = JSON.parse(data);
  } catch {}

  const index = selected.indexOf(image);
  if (index > -1) {
    selected.splice(index, 1);
  } else {
    selected.push(image);
  }

  await fs.writeFile(trainingFile, JSON.stringify(selected, null, 2));
  res.json({ selected });
});

// Get training selections
app.get("/api/training", async (req, res) => {
  const trainingFile = path.join(OUTPUT_DIR, "training-selected.json");
  try {
    const data = await fs.readFile(trainingFile, "utf-8");
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

// Export training images
app.post("/api/export", async (req, res) => {
  const trainingFile = path.join(OUTPUT_DIR, "training-selected.json");
  const exportDir = path.join(OUTPUT_DIR, "training");

  await fs.mkdir(exportDir, { recursive: true });

  let selected = [];
  try {
    const data = await fs.readFile(trainingFile, "utf-8");
    selected = JSON.parse(data);
  } catch {}

  // Include selected anchors
  const anchorsDir = path.join(OUTPUT_DIR, "anchors-selected");
  try {
    const anchorFiles = await fs.readdir(anchorsDir);
    for (const f of anchorFiles) {
      if (f.endsWith(".png")) {
        selected.push(`/output/anchors-selected/${f}`);
      }
    }
  } catch {}

  // Remove duplicates
  selected = [...new Set(selected)];

  let exported = 0;
  for (const imagePath of selected) {
    const srcPath = path.join(OUTPUT_DIR, imagePath.replace("/output/", ""));
    const filename = path.basename(imagePath);
    const destPath = path.join(exportDir, filename);

    try {
      await fs.copyFile(srcPath, destPath);
      exported++;
    } catch (e) {
      console.error(`Failed to copy: ${imagePath}`);
    }
  }

  res.json({ exported, total: selected.length });
});

// HTML UI
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>LoRA Image Gallery</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }
    h1 { margin-bottom: 10px; }
    .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
    .tab { padding: 10px 20px; background: #16213e; border: none; color: #eee; cursor: pointer; border-radius: 5px; font-size: 14px; }
    .tab.active { background: #e94560; }
    .stats { background: #16213e; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .folder { margin-bottom: 30px; }
    .folder-name { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #e94560; text-transform: capitalize; }
    .images { display: flex; flex-wrap: wrap; gap: 10px; }
    .img-wrap { position: relative; cursor: pointer; }
    .img-wrap img { 
      width: 180px; height: 180px; object-fit: cover; border-radius: 8px; 
      border: 4px solid transparent; transition: all 0.2s; 
    }
    .img-wrap:hover img { border-color: #e94560; transform: scale(1.02); }
    .img-wrap.selected img { border-color: #00ff88; box-shadow: 0 0 15px #00ff8866; }
    .check { 
      position: absolute; top: 8px; right: 8px; background: #00ff88; color: #000; 
      width: 28px; height: 28px; border-radius: 50%; display: none; 
      align-items: center; justify-content: center; font-weight: bold; font-size: 16px;
    }
    .img-wrap.selected .check { display: flex; }
    .export-btn { 
      position: fixed; bottom: 20px; right: 20px; padding: 15px 30px; 
      background: #00ff88; color: #000; border: none; border-radius: 8px; 
      font-size: 16px; font-weight: bold; cursor: pointer; z-index: 100;
    }
    .export-btn:hover { background: #00cc6a; }
    .modal { 
      display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.95); z-index: 1000; align-items: center; justify-content: center; 
    }
    .modal.active { display: flex; }
    .modal img { max-width: 90%; max-height: 90%; border-radius: 8px; }
    .help { font-size: 13px; color: #888; margin-top: 5px; }
  </style>
</head>
<body>
  <h1>🎨 LoRA Training Image Gallery</h1>
  
  <div class="tabs">
    <button class="tab active" onclick="showPhase('anchors')">Phase 1: Anchors</button>
    <button class="tab" onclick="showPhase('variations')">Phase 2: Variations</button>
  </div>
  
  <div class="stats" id="stats"></div>
  <div id="gallery"></div>
  <button class="export-btn" onclick="exportTraining()">📦 Export Training Set</button>
  
  <div class="modal" id="modal" onclick="closeModal()">
    <img id="modal-img" src="">
  </div>

  <script>
    let currentPhase = 'anchors';
    let images = {};
    let anchorSelections = {};
    let trainingSelections = [];

    async function loadData() {
      const [imgRes, anchorRes, trainingRes] = await Promise.all([
        fetch('/api/images/' + currentPhase).then(r => r.json()),
        fetch('/api/selected/anchors').then(r => r.json()),
        fetch('/api/training').then(r => r.json())
      ]);
      images = imgRes;
      anchorSelections = anchorRes;
      trainingSelections = trainingRes;
      render();
    }

    function showPhase(phase) {
      currentPhase = phase;
      document.querySelectorAll('.tab').forEach((t, i) => {
        t.classList.toggle('active', (phase === 'anchors' && i === 0) || (phase === 'variations' && i === 1));
      });
      loadData();
    }

    function render() {
      const gallery = document.getElementById('gallery');
      const stats = document.getElementById('stats');
      
      let totalImages = 0;
      let html = '';
      const folders = Object.keys(images).sort();

      for (const folder of folders) {
        const imgs = images[folder];
        totalImages += imgs.length;
        html += '<div class="folder">';
        html += '<div class="folder-name">' + folder.replace(/_/g, ' ') + '</div>';
        html += '<div class="images">';
        
        for (const img of imgs) {
          const isAnchorSelected = currentPhase === 'anchors' && anchorSelections[folder] === img;
          const isTrainingSelected = trainingSelections.includes(img);
          const isSelected = isAnchorSelected || isTrainingSelected;
          
          html += '<div class="img-wrap ' + (isSelected ? 'selected' : '') + '" ';
          html += 'onclick="selectImage(\\'' + folder + '\\', \\'' + img + '\\')" ';
          html += 'oncontextmenu="showLarge(\\'' + img + '\\'); return false;">';
          html += '<img src="' + img + '" loading="lazy">';
          html += '<div class="check">✓</div>';
          html += '</div>';
        }
        
        html += '</div></div>';
      }

      gallery.innerHTML = html || '<p style="padding:20px;">No images found. Run <code>npm run phase1</code> first.</p>';
      
      if (currentPhase === 'anchors') {
        const selected = Object.keys(anchorSelections).length;
        stats.innerHTML = '<strong>Anchors:</strong> ' + totalImages + ' images across ' + folders.length + ' poses<br>';
        stats.innerHTML += '<strong>Selected:</strong> ' + selected + ' / 8 anchors';
        stats.innerHTML += '<div class="help">Click to select the best image for each anchor pose. Right-click to view large.</div>';
      } else {
        stats.innerHTML = '<strong>Variations:</strong> ' + totalImages + ' images across ' + folders.length + ' poses<br>';
        stats.innerHTML += '<strong>Selected for training:</strong> ' + trainingSelections.length + ' images';
        stats.innerHTML += '<div class="help">Click to add/remove from training set. Aim for 20-30 total. Right-click to view large.</div>';
      }
    }

    async function selectImage(folder, img) {
      if (currentPhase === 'anchors') {
        await fetch('/api/select/anchors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder, image: img })
        });
      } else {
        await fetch('/api/training/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: img })
        });
      }
      loadData();
    }

    function showLarge(img) {
      document.getElementById('modal-img').src = img;
      document.getElementById('modal').classList.add('active');
    }

    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }

    async function exportTraining() {
      const res = await fetch('/api/export', { method: 'POST' });
      const data = await res.json();
      alert('✅ Exported ' + data.exported + ' images to output/training/');
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

    loadData();
  </script>
</body>
</html>`);
});

// Start server
app.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           LoRA IMAGE GALLERY                                  ║
╠═══════════════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                               ║
╠═══════════════════════════════════════════════════════════════╣
║  • Click image     → Select for training                      ║
║  • Right-click     → View full size                           ║
║  • Export button   → Copy selected to training folder         ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  try {
    await open(`http://localhost:${PORT}`);
  } catch {}
});
